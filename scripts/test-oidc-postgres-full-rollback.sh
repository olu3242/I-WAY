#!/usr/bin/env bash
set -euo pipefail
# Disposable PG: a failed role binding must roll back nonce, proof, account,
# acceptance and audit, with no partial activation.
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO operations_onboarding.invitations
(id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
VALUES ('51515151-5151-4515-8515-515151515151',
 '61616161-6161-4616-8616-616161616161',
 '71717171-7171-4717-8717-717171717171',
 'rollback-e2e@example.invalid','{"role":"driver"}','fixture',repeat('d',64),
 'VERIFIED',now()+interval '1 hour');
INSERT INTO operations_onboarding.identity_nonce_challenges
(nonce_hash,invitation_id,tenant_id,expires_at)
VALUES (repeat('e',64),'51515151-5151-4515-8515-515151515151',
 '61616161-6161-4616-8616-616161616161',now()+interval '5 minutes');
-- A caught check violation inside a nested transaction aborts the nested block.
-- Raise an outer exception only if the expected constraint did not fire.
DO $assert$
BEGIN
 BEGIN
  UPDATE operations_onboarding.identity_nonce_challenges SET consumed_at=now()
   WHERE nonce_hash=repeat('e',64) AND consumed_at IS NULL;
  INSERT INTO operations_onboarding.identity_proof_uses(proof_hash,invitation_id,tenant_id)
   VALUES (repeat('f',64),'51515151-5151-4515-8515-515151515151','61616161-6161-4616-8616-616161616161');
  UPDATE operations_onboarding.invitations SET state='ACCEPTED'
   WHERE id='51515151-5151-4515-8515-515151515151' AND state='VERIFIED';
  INSERT INTO operations_onboarding.provisioned_accounts(id,issuer,subject_hash)
   VALUES ('81818181-8181-4818-8818-818181818181','fixture',repeat('d',64));
  INSERT INTO operations_onboarding.tenant_role_bindings(tenant_id,account_id,role,invitation_id)
   VALUES ('61616161-6161-4616-8616-616161616161','81818181-8181-4818-8818-818181818181',
   'forbidden_role','51515151-5151-4515-8515-515151515151');
  RAISE EXCEPTION 'EXPECTED_ROLE_CHECK_VIOLATION';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM operations_onboarding.identity_proof_uses WHERE proof_hash=repeat('f',64))
 OR EXISTS(SELECT 1 FROM operations_onboarding.provisioned_accounts WHERE id='81818181-8181-4818-8818-818181818181')
 OR EXISTS(SELECT 1 FROM operations_onboarding.identity_nonce_challenges WHERE nonce_hash=repeat('e',64) AND consumed_at IS NOT NULL)
 OR (SELECT state FROM operations_onboarding.invitations WHERE id='51515151-5151-4515-8515-515151515151')<>'VERIFIED'
 THEN RAISE EXCEPTION 'ATOMIC_ROLLBACK_FAILED'; END IF;
END;
$assert$;
SQL
echo 'PASS: invalid role binding rolls back nonce, proof, account and acceptance'
