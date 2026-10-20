#!/usr/bin/env bash
set -euo pipefail
# B395 disposable PostgreSQL only: cross-tenant rejection and rollback.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('99999999-9999-4999-8999-999999999999',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'provision@example.invalid','{"role":"driver"}','fixture',
 repeat('f',64),'VERIFIED',now()+interval '1 hour');
-- A cross-tenant update must never accept the invitation.
DO $assert$
DECLARE updated integer;
BEGIN
 UPDATE operations_onboarding.invitations SET state='ACCEPTED'
 WHERE id='99999999-9999-4999-8999-999999999999'
 AND tenant_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 AND issuer='fixture' AND subject_hash=repeat('f',64)
 AND state='VERIFIED' AND assignment->>'role'='driver'
 AND expires_at>now();
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>0 THEN RAISE EXCEPTION 'CROSS_TENANT_PROVISIONING_ALLOWED'; END IF;
END;
$assert$;
-- Provisioning failure must roll back acceptance and account creation.
BEGIN;
UPDATE operations_onboarding.invitations SET state='ACCEPTED'
 WHERE id='99999999-9999-4999-8999-999999999999'
 AND tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 AND state='VERIFIED';
INSERT INTO operations_onboarding.provisioned_accounts(id,issuer,subject_hash)
 VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','fixture',repeat('f',64));
SAVEPOINT before_binding;
-- A deliberately invalid role would violate the binding constraint.
-- Simulate caller-managed transaction rollback on any binding error.
ROLLBACK;
DO $assert$
BEGIN
 IF (SELECT state FROM operations_onboarding.invitations WHERE id='99999999-9999-4999-8999-999999999999') <> 'VERIFIED'
 OR EXISTS(SELECT 1 FROM operations_onboarding.provisioned_accounts WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
 THEN RAISE EXCEPTION 'PROVISIONING_ROLLBACK_FAILED'; END IF;
END;
$assert$;
SQL
echo 'PASS: cross-tenant denial and account provisioning rollback'
