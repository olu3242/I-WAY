-- Read-only review of B531/B532 findings. NO privilege changes or migration.
-- Administrative catalog evidence is not restricted-login certification.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
DO $review$
DECLARE runtime_oid oid;
BEGIN
 SELECT oid INTO runtime_oid FROM pg_roles WHERE rolname='iway_auth_runtime'
  AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
  AND NOT rolcreatedb AND NOT rolinherit AND NOT rolreplication;
 IF runtime_oid IS NULL THEN RAISE EXCEPTION 'AUTH_RUNTIME_ATTRIBUTES_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles administrator ON administrator.oid=m.member
  JOIN pg_roles grantor ON grantor.oid=m.grantor
  WHERE m.member=runtime_oid OR (m.roleid=runtime_oid AND NOT (
   administrator.rolname='postgres' AND administrator.rolcreaterole
   AND grantor.oid=10 AND grantor.rolsuper
   AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)))
 THEN RAISE EXCEPTION 'AUTH_RUNTIME_MEMBERSHIP_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%'
  AND (n.nspowner=runtime_oid OR has_schema_privilege(runtime_oid,n.oid,'CREATE')))
 THEN RAISE EXCEPTION 'AUTH_RUNTIME_DDL_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r','p','v','m')
  AND NOT(n.nspname='iway_private' AND c.relname IN ('auth_pkce_transactions','auth_server_sessions','auth_tenant_roles','auth_tenants','auth_resources'))
  AND has_schema_privilege(runtime_oid,n.oid,'USAGE')
  AND (has_table_privilege(runtime_oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(runtime_oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 THEN RAISE EXCEPTION 'AUTH_RUNTIME_UNRELATED_ACCESS'; END IF;
END $review$;
COMMIT;
