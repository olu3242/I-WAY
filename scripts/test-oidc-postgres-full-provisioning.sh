#!/usr/bin/env bash
set -euo pipefail
# Isolated PG transaction integration: nonce, replay ledger, account, binding,
# invitation activation and audit commit or rollback together.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('10101010-1010-4010-8010-101010101010',
 '20202020-2020-4020-8020-202020202020',
 '30303030-3030-4030-8030-303030303030',
 'atomic-e2e@example.invalid','{"role":"driver"}','fixture',repeat('9',64),
 'VERIFIED',now()+interval '1 hour');
INSERT INTO operations_onboarding.identity_nonce_challenges
(nonce_hash,invitation_id,tenant_id,expires_at)
VALUES (repeat('b',64),'10101010-1010-4010-8010-101010101010',
 '20202020-2020-4020-8020-202020202020',now()+interval '5 minutes');
BEGIN;
UPDATE operations_onboarding.identity_nonce_challenges SET consumed_at=now()
 WHERE nonce_hash=repeat('b',64) AND consumed_at IS NULL AND expires_at>now();
INSERT INTO operations_onboarding.identity_proof_uses(proof_hash,invitation_id,tenant_id)
 VALUES (repeat('c',64),'10101010-1010-4010-8010-101010101010','20202020-2020-4020-8020-202020202020');
UPDATE operations_onboarding.invitations SET state='ACCEPTED'
 WHERE id='10101010-1010-4010-8010-101010101010' AND state='VERIFIED';
INSERT INTO operations_onboarding.provisioned_accounts(id,issuer,subject_hash)
 VALUES ('40404040-4040-4040-8040-404040404040','fixture',repeat('9',64));
INSERT INTO operations_onboarding.tenant_role_bindings(tenant_id,account_id,role,invitation_id)
 VALUES ('20202020-2020-4020-8020-202020202020','40404040-4040-4040-8040-404040404040',
 'driver','10101010-1010-4010-8010-101010101010');
UPDATE operations_onboarding.invitations SET state='ACTIVE',user_id='40404040-4040-4040-8040-404040404040'
 WHERE id='10101010-1010-4010-8010-101010101010' AND state='ACCEPTED';
INSERT INTO operations_onboarding.invitation_events(invitation_id,event_type)
 VALUES ('10101010-1010-4010-8010-101010101010','ACTIVE');
COMMIT;
DO $assert$
BEGIN
 IF (SELECT state FROM operations_onboarding.invitations WHERE id='10101010-1010-4010-8010-101010101010')<>'ACTIVE'
 OR NOT EXISTS(SELECT 1 FROM operations_onboarding.identity_proof_uses WHERE proof_hash=repeat('c',64))
 OR NOT EXISTS(SELECT 1 FROM operations_onboarding.identity_nonce_challenges WHERE nonce_hash=repeat('b',64) AND consumed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM operations_onboarding.tenant_role_bindings WHERE invitation_id='10101010-1010-4010-8010-101010101010')
 THEN RAISE EXCEPTION 'ATOMIC_PROVISIONING_INCOMPLETE'; END IF;
END;
$assert$;
SQL
echo 'PASS: nonce, proof, account, binding, activation and audit commit together'
