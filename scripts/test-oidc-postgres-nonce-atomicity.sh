#!/usr/bin/env bash
set -euo pipefail
# Disposable PG only: nonce must be consumed once, and rollback restores it.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('11111111-2222-4333-8444-555555555555',
 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
 'nonce-integration@example.invalid','{"role":"driver"}','fixture',
 repeat('e',64),'VERIFIED',now()+interval '1 hour');
INSERT INTO operations_onboarding.identity_nonce_challenges
(nonce_hash,invitation_id,tenant_id,expires_at)
VALUES (repeat('c',64),'11111111-2222-4333-8444-555555555555',
 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',now()+interval '5 minutes');
-- A transaction aborted after nonce consumption must leave it unconsumed.
BEGIN;
UPDATE operations_onboarding.identity_nonce_challenges SET consumed_at=now()
 WHERE nonce_hash=repeat('c',64) AND consumed_at IS NULL AND expires_at>now();
ROLLBACK;
DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM operations_onboarding.identity_nonce_challenges
 WHERE nonce_hash=repeat('c',64) AND consumed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'NONCE_ROLLBACK_FAILED'; END IF;
END;
$assert$;
-- A committed consumption must prevent replay.
BEGIN;
UPDATE operations_onboarding.identity_nonce_challenges SET consumed_at=now()
 WHERE nonce_hash=repeat('c',64) AND invitation_id='11111111-2222-4333-8444-555555555555'
 AND tenant_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
 AND consumed_at IS NULL AND expires_at>now();
COMMIT;
DO $assert$
DECLARE changed integer;
BEGIN
 UPDATE operations_onboarding.identity_nonce_challenges SET consumed_at=now()
 WHERE nonce_hash=repeat('c',64) AND consumed_at IS NULL AND expires_at>now();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'NONCE_REPLAY_ACCEPTED'; END IF;
END;
$assert$;
SQL
echo 'PASS: nonce rollback and replay protection'
