-- REVIEW ONLY. Read-only catalog assertions; no role/schema/user provisioning.
DO $verify$
DECLARE r record; n integer; x record; wanted text[]; actual text[];
BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname='iway_uat_runtime';
 IF NOT FOUND THEN RAISE EXCEPTION 'B631_BROKER_ROLE_MISSING'; END IF;
 IF NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)
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
