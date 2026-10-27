#!/usr/bin/env bash
set -euo pipefail
# B393 disposable fixture: acceptance and audit share a transaction.
# Competing sessions may not accept the same verified invitation twice.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 '77777777-7777-4777-8777-777777777777',
 '88888888-8888-4888-8888-888888888888',
 'acceptance@example.invalid','{"role":"driver"}','fixture',
 repeat('e',64),'VERIFIED',now()+interval '1 hour');
SQL
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
for n in $(seq 1 8); do
 (
 psql -v ON_ERROR_STOP=1 -At <<'SQL' > "$dir/$n"
BEGIN;
WITH accepted AS (
 UPDATE operations_onboarding.invitations SET state='ACCEPTED'
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 AND tenant_id='77777777-7777-4777-8777-777777777777'
 AND issuer='fixture' AND subject_hash=repeat('e',64)
 AND state='VERIFIED' AND expires_at>now()
 RETURNING id
), audited AS (
 INSERT INTO operations_onboarding.invitation_events(invitation_id,event_type)
 SELECT id,'ACCEPTED' FROM accepted RETURNING invitation_id
)
SELECT invitation_id FROM audited;
COMMIT;
SQL
 ) &
done
wait
winners="$(grep -l 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' "$dir"/* | wc -l)"
test "$winners" -eq 1 || { echo "Expected one accepted invitation, got $winners"; exit 1; }
count="$(psql -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM operations_onboarding.invitation_events WHERE invitation_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND event_type='ACCEPTED'")"
test "$count" = 1 || { echo "Expected one acceptance audit, got $count"; exit 1; }
# Force a transaction rollback after a conditional acceptance and audit insert.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '77777777-7777-4777-8777-777777777777',
 '88888888-8888-4888-8888-888888888888',
 'rollback@example.invalid','{"role":"driver"}','fixture',
 repeat('f',64),'VERIFIED',now()+interval '1 hour');
BEGIN;
UPDATE operations_onboarding.invitations SET state='ACCEPTED'
 WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' AND state='VERIFIED';
INSERT INTO operations_onboarding.invitation_events(invitation_id,event_type)
 VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','ACCEPTED');
ROLLBACK;
DO $check$
BEGIN
 IF (SELECT state FROM operations_onboarding.invitations WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 'VERIFIED'
 OR (SELECT count(*) FROM operations_onboarding.invitation_events WHERE invitation_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 0
 THEN RAISE EXCEPTION 'ACCEPTANCE_ROLLBACK_FAILED'; END IF;
END;
$check$;
SQL
echo 'PASS: one acceptance, one audit, rollback preserved original state'
