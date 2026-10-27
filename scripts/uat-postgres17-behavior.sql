-- Behavioral tests execute in the disposable PostgreSQL 17 container only.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE iway_registration;
INSERT INTO iway_private.early_access_leads(name,email,email_hash,role,consent,consent_version)
VALUES('Test User','test@example.invalid',repeat('a',64),'driver',true,'test-v1');
ROLLBACK;
DO $$
BEGIN
 IF has_table_privilege('iway_registration','iway_private.early_access_leads','SELECT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'Registration role has excess grants';
 END IF;
 IF has_table_privilege('iway_operations_runtime','operations_private.dispatcher_directory','INSERT,UPDATE,DELETE') THEN
  RAISE EXCEPTION 'Runtime can mutate dispatcher directory';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_dispatcher_provisioner' AND (rolcanlogin OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Provisioner can login or bypass RLS';
 END IF;
END $$;
-- Assert that cross-tenant writes fail under provisioner role, without granting it login.
BEGIN;
SET LOCAL ROLE iway_dispatcher_provisioner;
SELECT set_config('iway.tenant_id','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('iway.actor_id','00000000-0000-0000-0000-000000000002',true);
DO $$
BEGIN
 BEGIN
  INSERT INTO operations_private.dispatcher_directory(tenant_id,id,active)
  VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',true);
  RAISE EXCEPTION 'Cross-tenant insert unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN
  NULL;
 END;
END $$;
ROLLBACK;
SELECT 'BEHAVIORAL AUTHORIZATION CHECKS PASS' AS result;
