#!/usr/bin/env bash
set -euo pipefail
# Disposable PostgreSQL fixture only. Eight independent psql sessions race
# a conditional state transition; the database must permit exactly one winner.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES
('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '55555555-5555-4555-8555-555555555555',
 '66666666-6666-4666-8666-666666666666',
 'race@example.invalid','{"role":"driver"}','fixture',
 repeat('d',64),'SENT',now()+interval '1 hour');
SQL
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
for n in $(seq 1 8); do
  (
    psql -v ON_ERROR_STOP=1 -Atc "
      UPDATE operations_onboarding.invitations
      SET state='OPENED'
      WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        AND state='SENT' AND expires_at>now()
      RETURNING id;" > "$dir/$n"
  ) &
done
wait
winners="$(grep -l 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' "$dir"/* | wc -l)"
test "$winners" -eq 1 || { echo "Expected one winning transition; got $winners"; exit 1; }
state="$(psql -v ON_ERROR_STOP=1 -Atc "SELECT state FROM operations_onboarding.invitations WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'")"
test "$state" = OPENED || { echo "Incorrect final state: $state"; exit 1; }
echo 'PASS: exactly one of eight concurrent PostgreSQL transitions succeeded'
