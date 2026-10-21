-- B498 authorized read-only metadata inventory. No user/session/token row reads.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT current_user AS inspector,current_setting('server_version_num') AS postgres_version,
 to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_present;
SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl FROM pg_namespace WHERE nspname='iway_private';
SELECT c.relname,c.relkind,c.relispartition,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iway_private' AND c.relname IN ('auth_tenant_roles','auth_pkce_transactions','auth_server_sessions','auth_tenants','auth_resources');
SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attacl
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iway_private' AND c.relname IN ('auth_tenant_roles','auth_pkce_transactions','auth_server_sessions','auth_tenants','auth_resources')
 AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iway_private' AND c.relname IN ('auth_tenant_roles','auth_pkce_transactions','auth_server_sessions','auth_tenants','auth_resources');
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='iway_private'
 AND tablename IN ('auth_tenant_roles','auth_pkce_transactions','auth_server_sessions','auth_tenants','auth_resources');
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='iway_private'
 AND tablename IN ('auth_tenant_roles','auth_pkce_transactions','auth_server_sessions','auth_tenants','auth_resources');
SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
 FROM pg_roles WHERE rolname IN ('iway_auth_runtime','anon','authenticated','service_role');
SELECT parent.rolname AS parent_role,member.rolname AS member_role,m.admin_option
 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
 WHERE member.rolname='iway_auth_runtime';
SELECT pg_get_userbyid(defaclrole) AS owner,defaclnamespace::regnamespace::text AS schema,defaclobjtype,defaclacl
 FROM pg_default_acl WHERE defaclnamespace IN (0,COALESCE((SELECT oid FROM pg_namespace WHERE nspname='iway_private'),0));
-- B511: defaults, generated columns, dependencies and privilege paths (metadata only).
SELECT c.relname,a.attname,a.attnotnull,a.attidentity,a.attgenerated,
 pg_get_expr(d.adbin,d.adrelid) AS default_expression
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE n.nspname='iway_private' AND c.relname='auth_tenant_roles' AND a.attnum>0 AND NOT a.attisdropped;
SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent,d.deptype
 FROM pg_depend d WHERE d.refobjid=to_regclass('iway_private.auth_tenant_roles');
SELECT n.nspname,c.relname,
 has_table_privilege((SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime'),c.oid,'SELECT') AS can_select,
 has_table_privilege((SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime'),c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS can_mutate
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iway_auth_runtime') AND n.nspname IN ('public','auth','iway_private')
 AND c.relkind IN ('r','p','v','m');
-- History values: only version identifiers, never migration statements or row data.
DO $history$ DECLARE entry record; BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
  FOR entry IN EXECUTE 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version' LOOP
   RAISE NOTICE 'migration_version: %',entry.version;
  END LOOP;
 ELSE RAISE NOTICE 'migration_history_absent'; END IF;
END $history$;
COMMIT;
