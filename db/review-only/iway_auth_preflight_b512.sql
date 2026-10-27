-- Read-only preflight; does not assert hosted approval.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $preflight$
DECLARE expected record; existing oid; actual_type text; item record;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('auth_pkce_transactions','state_hash','text',true),
 ('auth_pkce_transactions','verifier','text',true),
 ('auth_pkce_transactions','expires_at','timestamp with time zone',true),
 ('auth_pkce_transactions','consumed_at','timestamp with time zone',false),
 ('auth_pkce_transactions','created_at','timestamp with time zone',true),
 ('auth_server_sessions','session_hash','text',true),
 ('auth_server_sessions','user_id','uuid',true),
 ('auth_server_sessions','access_token','text',true),
 ('auth_server_sessions','refresh_token','text',true),
 ('auth_server_sessions','expires_at','timestamp with time zone',true),
 ('auth_server_sessions','access_expires_at','timestamp with time zone',false),
 ('auth_server_sessions','revoked_at','timestamp with time zone',true),
 ('auth_server_sessions','refresh_claim','uuid',false),
 ('auth_server_sessions','refresh_started_at','timestamp with time zone',false),
 ('auth_server_sessions','token_version','bigint',false),
 ('auth_server_sessions','created_at','timestamp with time zone',true),
 ('auth_tenant_roles','user_id','uuid',true),
 ('auth_tenant_roles','tenant_id','uuid',true),
 ('auth_tenant_roles','role','text',true),
 ('auth_tenant_roles','granted_at','timestamp with time zone',true),
 ('auth_tenant_roles','revoked_at','timestamp with time zone',true),
 ('auth_tenant_roles','active','boolean',false),
 ('auth_tenant_roles','permissions','text[]',false),
 ('auth_tenant_roles','principal_id','uuid',false),
 ('auth_tenant_roles','fleet_id','uuid',false),
 ('auth_tenants','tenant_id','uuid',true),
 ('auth_tenants','active','boolean',true),
 ('auth_resources','resource_id','uuid',true),
 ('auth_resources','tenant_id','uuid',true),
 ('auth_resources','kind','text',true),
 ('auth_resources','fleet_id','uuid',true),
 ('auth_resources','driver_id','uuid',true),
 ('auth_resources','active','boolean',true)
 ) AS contract(table_name,column_name,type_name,required_before_upgrade) LOOP
  existing:=to_regclass('iway_private.'||expected.table_name);
  IF existing IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=existing AND relkind='r' AND NOT relispartition)
   THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: relation kind'; END IF;
   SELECT format_type(atttypid,atttypmod) INTO actual_type FROM pg_attribute WHERE attrelid=existing AND attname=expected.column_name AND attnum>0 AND NOT attisdropped;
   IF (actual_type IS NULL AND expected.required_before_upgrade) OR (actual_type IS NOT NULL AND actual_type<>expected.type_name)
   THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: %.%',expected.table_name,expected.column_name; END IF;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime'))
 THEN RAISE EXCEPTION 'AUTH_RUNTIME_ROLE_MEMBERSHIP_UNREVIEWED'; END IF;
 FOR item IN SELECT c.oid,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='iway_private' AND c.relname IN ('auth_pkce_transactions','auth_server_sessions','auth_tenant_roles','auth_tenants','auth_resources') LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=item.oid AND k.contype='p' AND
   ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY cols(num,position)
    JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=cols.num ORDER BY cols.position)=
   CASE item.relname WHEN 'auth_pkce_transactions' THEN ARRAY['state_hash']
    WHEN 'auth_server_sessions' THEN ARRAY['session_hash'] WHEN 'auth_tenant_roles' THEN ARRAY['user_id','tenant_id','role']
    WHEN 'auth_tenants' THEN ARRAY['tenant_id'] ELSE ARRAY['resource_id'] END)
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: primary key'; END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=item.oid AND k.contype='f' AND NOT (
   item.relname IN ('auth_tenant_roles','auth_server_sessions','auth_resources') AND k.convalidated AND NOT k.condeferrable
   AND k.confupdtype='a' AND k.confmatchtype='s'
   AND k.confrelid=CASE WHEN item.relname='auth_resources' THEN to_regclass('iway_private.auth_tenants') ELSE to_regclass('auth.users') END
   AND k.confdeltype=ANY(CASE WHEN item.relname='auth_tenant_roles' THEN ARRAY['r','c']::"char"[] ELSE ARRAY['r']::"char"[] END)
   AND k.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=item.oid AND attname=CASE WHEN item.relname='auth_resources' THEN 'tenant_id' ELSE 'user_id' END)]::smallint[]
   AND k.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.confrelid AND attname=CASE WHEN item.relname='auth_resources' THEN 'tenant_id' ELSE 'id' END)]::smallint[]))
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: foreign key semantics'; END IF;
  IF item.relname IN ('auth_tenant_roles','auth_server_sessions') AND
   (SELECT count(*) FROM pg_constraint WHERE conrelid=item.oid AND contype='f')<>1
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: missing identity reference'; END IF;
  IF item.relname='auth_resources' AND NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conrelid=item.oid
    AND k.contype='f' AND k.confrelid=to_regclass('iway_private.auth_tenants') AND k.confdeltype='r' AND k.convalidated
    AND k.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=item.oid AND attname='tenant_id')]::smallint[]
    AND k.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.confrelid AND attname='tenant_id')]::smallint[])
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: resource tenant reference'; END IF;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=item.oid AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_UNREVIEWED_TRIGGER'; END IF;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=item.oid AND polname<>CASE item.relname
   WHEN 'auth_pkce_transactions' THEN 'auth_runtime_pkce' WHEN 'auth_server_sessions' THEN 'auth_runtime_sessions'
   WHEN 'auth_tenant_roles' THEN 'auth_runtime_roles' WHEN 'auth_tenants' THEN 'auth_runtime_tenants' ELSE 'auth_runtime_resources' END)
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_UNREVIEWED_POLICY'; END IF;
 END LOOP;
END $preflight$;
DO $contract$
DECLARE p record; expected text; actual text;
BEGIN
 FOR p IN SELECT c.relname,q.* FROM pg_policy q JOIN pg_class c ON c.oid=q.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iway_private' AND c.relname IN ('auth_pkce_transactions','auth_server_sessions','auth_tenant_roles','auth_tenants','auth_resources') LOOP
  expected:=CASE p.relname
   WHEN 'auth_pkce_transactions' THEN 'true'
   WHEN 'auth_server_sessions' THEN 'true'
   WHEN 'auth_tenant_roles' THEN 'user_id = NULLIF(current_setting(''iway.user_id''::text, true), ''''::text)::uuid AND active AND revoked_at IS NULL'
   WHEN 'auth_tenants' THEN 'active AND EXISTS SELECT 1 FROM iway_private.auth_tenant_roles m WHERE m.tenant_id = auth_tenants.tenant_id'
   WHEN 'auth_resources' THEN 'active AND EXISTS SELECT 1 FROM iway_private.auth_tenants t WHERE t.tenant_id = auth_resources.tenant_id' END;
  actual:=pg_get_expr(p.polqual,p.polrelid);
  IF regexp_replace(actual,'[[:space:]()]','','g')<>regexp_replace(expected,'[[:space:]()]','','g')
   OR actual IS NULL OR NOT p.polpermissive OR p.polroles<>ARRAY[(SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime')]
   OR p.polcmd<>(CASE WHEN p.relname IN ('auth_pkce_transactions','auth_server_sessions') THEN '*'::"char" ELSE 'r'::"char" END)
   OR (CASE WHEN p.relname IN ('auth_pkce_transactions','auth_server_sessions') THEN pg_get_expr(p.polwithcheck,p.polrelid) IS DISTINCT FROM 'true' ELSE p.polwithcheck IS NOT NULL END)
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: policy expression'; END IF;
 END LOOP;
END $contract$;
DO $shape$
DECLARE item record;
BEGIN
 FOR item IN SELECT c.relname,a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iway_private' AND c.relname IN ('auth_pkce_transactions','auth_server_sessions')
 AND a.attnum>0 AND NOT a.attisdropped AND a.attnotnull AND NOT a.atthasdef AND a.attgenerated=''
 AND a.attname<>ALL(CASE c.relname WHEN 'auth_pkce_transactions' THEN ARRAY['state_hash','expires_at','verifier'] ELSE ARRAY['session_hash','user_id','expires_at','access_token','refresh_token'] END) LOOP
  RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: unsupported required column';
 END LOOP;
 FOR item IN SELECT * FROM (VALUES ('iway_pkce_expiry_idx','auth_pkce_transactions'),('iway_sessions_expiry_idx','auth_server_sessions')) v(index_name,table_name) LOOP
  IF to_regclass('iway_private.'||item.index_name) IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_am am ON am.oid=c.relam
   WHERE i.indexrelid=to_regclass('iway_private.'||item.index_name) AND i.indrelid=to_regclass('iway_private.'||item.table_name)
   AND i.indisvalid AND i.indisready AND NOT i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL AND am.amname='btree'
   AND i.indnatts=1 AND i.indkey[0]=(SELECT attnum FROM pg_attribute WHERE attrelid=i.indrelid AND attname='expires_at'))
  THEN RAISE EXCEPTION 'AUTH_SCHEMA_INCOMPATIBLE: expiry index'; END IF;
 END LOOP;
END $shape$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_auth_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit AND NOT rolreplication AND rolcanlogin)
 THEN RAISE EXCEPTION 'Dedicated restricted iway_auth_runtime role must be provisioned first'; END IF;
END $$;
COMMIT;
