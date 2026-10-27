-- B841-B860: disposable PostgreSQL 17 RLS behavior tests.
-- All fixtures and modifications are rolled back. Run only after migrations.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO operations_private.tenants(id,name,timezone) VALUES
 ('10000000-0000-0000-0000-000000000001','Tenant A','UTC'),
 ('20000000-0000-0000-0000-000000000001','Tenant B','UTC');
INSERT INTO operations_private.users(tenant_id,id,username,data,password_hash) VALUES
 ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','dispatcher-a',
  '{"id":"10000000-0000-0000-0000-000000000002","tenantId":"10000000-0000-0000-0000-000000000001","role":"dispatcher","active":"true"}'::jsonb,'fixture'),
 ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','dispatcher-b',
  '{"id":"20000000-0000-0000-0000-000000000002","tenantId":"20000000-0000-0000-0000-000000000001","role":"dispatcher","active":"true"}'::jsonb,'fixture');
DO $$
BEGIN
 IF (SELECT count(*) FROM operations_private.dispatcher_directory) <> 2 THEN
  RAISE EXCEPTION 'Dispatcher trigger did not project both fixtures';
 END IF;
END $$;
SET LOCAL ROLE iway_dispatcher_provisioner;
SELECT set_config('iway.tenant_id','10000000-0000-0000-0000-000000000001',true);
SELECT set_config('iway.actor_id','10000000-0000-0000-0000-000000000002',true);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM operations_private.dispatcher_directory;
 IF n<>1 THEN RAISE EXCEPTION 'Tenant A directory visibility: expected 1, got %',n; END IF;
 SELECT count(*) INTO n FROM operations_private.dispatcher_directory WHERE tenant_id='20000000-0000-0000-0000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant directory read leaked % rows',n; END IF;
 UPDATE operations_private.dispatcher_directory SET active=false
 WHERE tenant_id='20000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant update affected % rows',n; END IF;
 UPDATE operations_private.dispatcher_directory SET active=false
 WHERE tenant_id='10000000-0000-0000-0000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Same-tenant update expected 1, got %',n; END IF;
 BEGIN
  INSERT INTO operations_private.dispatcher_directory(tenant_id,id,active)
  VALUES ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',true)
  ON CONFLICT (tenant_id,id) DO UPDATE SET active=excluded.active;
  RAISE EXCEPTION 'Cross-tenant upsert unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT active FROM operations_private.dispatcher_directory
  WHERE tenant_id='20000000-0000-0000-0000-000000000001') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Cross-tenant row was modified'; END IF;
 IF (SELECT active FROM operations_private.dispatcher_directory
  WHERE tenant_id='10000000-0000-0000-0000-000000000001') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Same-tenant update not persisted in test transaction'; END IF;
END $$;
ROLLBACK;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM operations_private.tenants WHERE id IN
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'))
 THEN RAISE EXCEPTION 'Fixture rollback failed'; END IF;
END $$;
SELECT 'B841-B860 TENANT RLS AND ROLLBACK PASS' AS result;
