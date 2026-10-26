-- REVIEW ONLY. NOT an automatically applied Supabase migration.
-- Owner approval is required before hosted application. Never run via the application runtime.
-- A credential owner must separately provision the broker role with reviewed restricted
-- flags and a securely delivered password. This script does NOT create/change roles,
-- credentials, Auth users, invites, memberships or tenant records.
-- First install only; a repeated application verifies without changing existing objects.
-- Partial schemas or security drift fail closed and require a separate reviewed repair.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('I-WAY B631 broker review',0));
DO $install$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname='iway_uat_runtime';
 IF NOT FOUND THEN RAISE EXCEPTION 'B631_BROKER_ROLE_MISSING'; END IF;
 IF NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles administrator ON administrator.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=r.oid OR (m.roleid=r.oid AND NOT (administrator.rolname='postgres' AND administrator.rolcreaterole AND grantor.oid=10 AND grantor.rolsuper AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option))) THEN RAISE EXCEPTION 'B631_BROKER_ROLE_UNSAFE'; END IF;
 IF to_regnamespace('iway_uat_private') IS NULL THEN
 EXECUTE $baseline$
CREATE SCHEMA iway_uat_private;
REVOKE ALL ON SCHEMA iway_uat_private FROM PUBLIC;
CREATE TABLE iway_uat_private.state(user_id uuid PRIMARY KEY,version integer NOT NULL DEFAULT 0 CHECK(version>=0),ready boolean NOT NULL DEFAULT false,active boolean NOT NULL DEFAULT true);
CREATE TABLE iway_uat_private.invites(hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),user_id uuid NOT NULL REFERENCES iway_uat_private.state(user_id),version integer NOT NULL,proof text,expires bigint NOT NULL,consumed bigint,revoked bigint,purpose text NOT NULL CHECK(purpose IN ('setup','recovery')));
CREATE TABLE iway_uat_private.bindings(hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),user_id uuid NOT NULL REFERENCES iway_uat_private.state(user_id),version integer NOT NULL,method text NOT NULL CHECK(method IN ('google','password')));
CREATE TABLE iway_uat_private.mfa(hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),user_id uuid NOT NULL REFERENCES iway_uat_private.state(user_id),version integer NOT NULL,tokens text,expires bigint NOT NULL,consumed bigint);
CREATE TABLE iway_uat_private.limits(bucket text PRIMARY KEY,expires bigint NOT NULL,count integer NOT NULL);
CREATE TABLE iway_uat_private.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event text NOT NULL,user_id uuid,actor_id uuid,at bigint NOT NULL);
-- These contain broker control metadata, not carrier/fleet business data. The trusted
-- broker deliberately operates across the four approved identities. Browser roles
-- receive no access. Business-resource RLS remains in iway_private under its own role.
ALTER TABLE iway_uat_private.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.state FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_state ON iway_uat_private.state TO iway_uat_runtime USING(true) WITH CHECK(true);
ALTER TABLE iway_uat_private.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.invites FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_invites ON iway_uat_private.invites TO iway_uat_runtime USING(true) WITH CHECK(true);
ALTER TABLE iway_uat_private.bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_bindings ON iway_uat_private.bindings TO iway_uat_runtime USING(true) WITH CHECK(true);
ALTER TABLE iway_uat_private.mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.mfa FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_mfa ON iway_uat_private.mfa TO iway_uat_runtime USING(true) WITH CHECK(true);
ALTER TABLE iway_uat_private.limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.limits FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_limits ON iway_uat_private.limits TO iway_uat_runtime USING(true) WITH CHECK(true);
ALTER TABLE iway_uat_private.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_private.audit FORCE ROW LEVEL SECURITY;
CREATE POLICY uat_audit ON iway_uat_private.audit FOR INSERT TO iway_uat_runtime WITH CHECK(true);
REVOKE ALL ON ALL TABLES IN SCHEMA iway_uat_private FROM PUBLIC;
GRANT USAGE ON SCHEMA iway_uat_private TO iway_uat_runtime;
GRANT SELECT ON iway_uat_private.state TO iway_uat_runtime;
GRANT UPDATE(version,ready,active) ON iway_uat_private.state TO iway_uat_runtime;
GRANT SELECT,INSERT,UPDATE ON iway_uat_private.invites,iway_uat_private.mfa TO iway_uat_runtime;
GRANT SELECT,INSERT ON iway_uat_private.bindings TO iway_uat_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON iway_uat_private.limits TO iway_uat_runtime;
GRANT INSERT ON iway_uat_private.audit TO iway_uat_runtime;
GRANT USAGE ON SEQUENCE iway_uat_private.audit_id_seq TO iway_uat_runtime;

$baseline$;
 END IF;
END
$install$;
-- REVIEW ONLY. Read-only catalog assertions; no role/schema/user provisioning.
DO $verify$
DECLARE r record; n integer; x record; wanted text[]; actual text[];
BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname='iway_uat_runtime';
 IF NOT FOUND THEN RAISE EXCEPTION 'B631_BROKER_ROLE_MISSING'; END IF;
 IF NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles administrator ON administrator.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=r.oid OR (m.roleid=r.oid AND NOT (administrator.rolname='postgres' AND administrator.rolcreaterole AND grantor.oid=10 AND grantor.rolsuper AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option)))
 OR has_database_privilege(r.oid,current_database(),'CREATE')
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema' AND (nspowner=r.oid OR has_schema_privilege(r.oid,oid,'CREATE')))
 OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid) THEN RAISE EXCEPTION 'B631_BROKER_ROLE_UNSAFE'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='iway_uat_private' AND c.relkind IN ('r','p');
 IF n<>6 THEN RAISE EXCEPTION 'B631_BROKER_SCHEMA_INCOMPLETE'; END IF;
 FOR x IN SELECT c.*,s.nspname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='iway_uat_private' AND c.relkind IN ('r','p') LOOP
 IF x.relname NOT IN ('state','invites','bindings','mfa','limits','audit') OR NOT x.relrowsecurity OR NOT x.relforcerowsecurity THEN RAISE EXCEPTION 'B631_BROKER_RLS_INVALID'; END IF;
 SELECT count(*) INTO n FROM pg_policy WHERE polrelid=x.oid AND polroles=ARRAY[r.oid] AND polpermissive
 AND polcmd=CASE WHEN x.relname='audit' THEN 'a'::char ELSE '*'::char END
 AND pg_get_expr(polwithcheck,polrelid)='true' AND (CASE WHEN x.relname='audit' THEN polqual IS NULL ELSE pg_get_expr(polqual,polrelid)='true' END);
 IF n<>1 OR (SELECT count(*) FROM pg_policy WHERE polrelid=x.oid)<>1 THEN RAISE EXCEPTION 'B631_BROKER_POLICY_INVALID'; END IF;
 IF has_table_privilege(r.oid,x.oid,'SELECT')<>(x.relname<>'audit')
 OR has_table_privilege(r.oid,x.oid,'INSERT')<>(x.relname<>'state')
 OR has_table_privilege(r.oid,x.oid,'UPDATE')<>(x.relname IN ('invites','mfa','limits'))
 OR has_table_privilege(r.oid,x.oid,'DELETE')<>(x.relname='limits')
 OR has_table_privilege(r.oid,x.oid,'TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege(r.oid,x.oid,'REFERENCES') THEN RAISE EXCEPTION 'B631_BROKER_GRANTS_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(x.relacl,acldefault('r',x.relowner))) a WHERE a.grantee NOT IN (x.relowner,r.oid) OR (a.grantee=r.oid AND a.is_grantable)) THEN RAISE EXCEPTION 'B631_BROKER_EXTERNAL_GRANT'; END IF;
 END LOOP;
 SELECT array_agg(attname::text ORDER BY attname) FILTER(WHERE has_column_privilege(r.oid,attrelid,attnum,'UPDATE')) INTO actual FROM pg_attribute WHERE attrelid='iway_uat_private.state'::regclass AND attnum>0 AND NOT attisdropped;
 IF actual IS DISTINCT FROM ARRAY['active','ready','version']::text[] THEN RAISE EXCEPTION 'B631_BROKER_COLUMN_GRANTS_INVALID'; END IF;
 IF NOT has_schema_privilege(r.oid,'iway_uat_private','USAGE') OR NOT has_sequence_privilege(r.oid,'iway_uat_private.audit_id_seq','USAGE') THEN RAISE EXCEPTION 'B631_BROKER_USAGE_MISSING'; END IF;
 -- Table grants alone do not cover grants on individual columns.
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_private' AND c.relkind IN ('r','p') AND (
 has_any_column_privilege(r.oid,c.oid,'SELECT')<>(c.relname<>'audit') OR
 has_any_column_privilege(r.oid,c.oid,'INSERT')<>(c.relname<>'state') OR
 has_any_column_privilege(r.oid,c.oid,'UPDATE')<>(c.relname IN ('state','invites','mfa','limits')))) THEN RAISE EXCEPTION 'B631_BROKER_COLUMN_GRANTS_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (n.nspname<>'iway_uat_private' OR c.relname NOT IN ('state','invites','bindings','mfa','limits','audit')) AND c.relkind IN ('r','p','v','m','f') AND has_schema_privilege(r.oid,n.oid,'USAGE') AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'B631_BROKER_UNRELATED_EXPOSURE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'B631_BROKER_DEFINER_EXPOSURE'; END IF;


 -- Exact column/type/nullability shape; constraints below preserve critical broker invariants.
 WITH expected(table_name,columns) AS (VALUES
 ('state','user_id:uuid:true,version:integer:true,ready:boolean:true,active:boolean:true'),
 ('invites','hash:text:true,user_id:uuid:true,version:integer:true,proof:text:false,expires:bigint:true,consumed:bigint:false,revoked:bigint:false,purpose:text:true'),
 ('bindings','hash:text:true,user_id:uuid:true,version:integer:true,method:text:true'),
 ('mfa','hash:text:true,user_id:uuid:true,version:integer:true,tokens:text:false,expires:bigint:true,consumed:bigint:false'),
 ('limits','bucket:text:true,expires:bigint:true,count:integer:true'),
 ('audit','id:bigint:true,event:text:true,user_id:uuid:false,actor_id:uuid:false,at:bigint:true'))
 SELECT count(*) INTO n FROM expected e WHERE e.columns IS DISTINCT FROM (SELECT string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull,',' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=('iway_uat_private.'||e.table_name)::regclass AND a.attnum>0 AND NOT a.attisdropped);
 IF n<>0 THEN RAISE EXCEPTION 'B631_BROKER_COLUMN_SHAPE_INVALID'; END IF;
 FOR x IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='iway_uat_private' AND c.relkind='r' LOOP
  SELECT count(*) INTO n FROM pg_constraint WHERE conrelid=x.oid AND contype<>'n';
  IF n<>(CASE x.relname WHEN 'state' THEN 2 WHEN 'invites' THEN 4 WHEN 'bindings' THEN 4 WHEN 'mfa' THEN 3 ELSE 1 END)
  OR (SELECT count(*) FROM pg_constraint WHERE conrelid=x.oid AND contype='p' AND convalidated AND pg_get_constraintdef(oid)=CASE x.relname WHEN 'state' THEN 'PRIMARY KEY (user_id)' WHEN 'limits' THEN 'PRIMARY KEY (bucket)' WHEN 'audit' THEN 'PRIMARY KEY (id)' ELSE 'PRIMARY KEY (hash)' END)<>1
  THEN RAISE EXCEPTION 'B631_BROKER_CONSTRAINT_INVALID'; END IF;
  IF x.relname IN ('invites','bindings','mfa') AND (SELECT count(*) FROM pg_constraint WHERE conrelid=x.oid AND contype='f' AND convalidated AND pg_get_constraintdef(oid)='FOREIGN KEY (user_id) REFERENCES iway_uat_private.state(user_id)')<>1 THEN RAISE EXCEPTION 'B631_BROKER_CONSTRAINT_INVALID'; END IF;
 END LOOP;
 WITH expected(table_name,expression) AS (VALUES
 ('state','(version >= 0)'),
 ('invites',$expr$(hash ~ '^[a-f0-9]{64}$'::text)$expr$),
 ('invites',$expr$(purpose = ANY (ARRAY['setup'::text, 'recovery'::text]))$expr$),
 ('bindings',$expr$(hash ~ '^[a-f0-9]{64}$'::text)$expr$),
 ('bindings',$expr$(method = ANY (ARRAY['google'::text, 'password'::text]))$expr$),
 ('mfa',$expr$(hash ~ '^[a-f0-9]{64}$'::text)$expr$))
 SELECT count(*) INTO n FROM expected e WHERE NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid=('iway_uat_private.'||e.table_name)::regclass AND c.contype='c' AND c.convalidated AND pg_get_expr(c.conbin,c.conrelid)=e.expression);
 IF n<>0 THEN RAISE EXCEPTION 'B631_BROKER_CONSTRAINT_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace s, LATERAL aclexplode(COALESCE(s.nspacl,acldefault('n',s.nspowner))) a WHERE s.nspname='iway_uat_private' AND (a.grantee NOT IN (s.nspowner,r.oid) OR (a.grantee=r.oid AND (a.privilege_type<>'USAGE' OR a.is_grantable)))) THEN RAISE EXCEPTION 'B631_BROKER_SCHEMA_EXPOSURE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace, LATERAL aclexplode(COALESCE(c.relacl,acldefault('s',c.relowner))) a WHERE s.nspname='iway_uat_private' AND c.relkind='S' AND (c.relname<>'audit_id_seq' OR a.grantee NOT IN (c.relowner,r.oid) OR (a.grantee=r.oid AND (a.privilege_type<>'USAGE' OR a.is_grantable)))) THEN RAISE EXCEPTION 'B631_BROKER_SEQUENCE_EXPOSURE'; END IF;
 IF (SELECT attidentity FROM pg_attribute WHERE attrelid='iway_uat_private.audit'::regclass AND attname='id')<>'a' THEN RAISE EXCEPTION 'B631_BROKER_IDENTITY_INVALID'; END IF;

END
$verify$;

COMMIT;
