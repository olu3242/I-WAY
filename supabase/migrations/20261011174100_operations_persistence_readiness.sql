-- OFFLINE READINESS ONLY. Not applied or certified. No role creation, passwords or application grants.
-- A future reviewed deployment must use a dedicated non-owner, non-BYPASSRLS operations role.
-- Tenant/actor GUCs are set only by the authenticated server transaction, not trusted client input.
-- This is storage groundwork; SQLite business/authentication parity and live RLS tests remain release gates.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA operations_private;
REVOKE ALL ON SCHEMA operations_private FROM PUBLIC;
CREATE TABLE operations_private.tenants (
 id uuid PRIMARY KEY, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200), timezone text NOT NULL
);
CREATE TABLE operations_private.users (
 tenant_id uuid NOT NULL REFERENCES operations_private.tenants(id),
 id uuid NOT NULL, username text NOT NULL, data jsonb NOT NULL, password_hash text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,username),
 CHECK (jsonb_typeof(data)='object' AND data @> jsonb_build_object('id',id::text,'tenantId',tenant_id::text))
);
CREATE TABLE operations_private.sessions (
 tenant_id uuid NOT NULL, token_hash text NOT NULL, user_id uuid NOT NULL, csrf_hash text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(tenant_id,token_hash),
 FOREIGN KEY(tenant_id,user_id) REFERENCES operations_private.users(tenant_id,id)
);
CREATE INDEX operations_sessions_user ON operations_private.sessions(tenant_id,user_id);
CREATE TABLE operations_private.resources (
 tenant_id uuid NOT NULL REFERENCES operations_private.tenants(id), kind text NOT NULL CHECK(kind ~ '^[a-z][a-z0-9_]{0,47}$'),
 id uuid NOT NULL, version integer NOT NULL CHECK(version>0), data jsonb NOT NULL,
 referenced_load_id uuid GENERATED ALWAYS AS ((data->>'loadId')::uuid) STORED,
 referenced_load_kind text GENERATED ALWAYS AS (CASE WHEN data->>'loadId' IS NOT NULL THEN 'load' ELSE NULL END) STORED,
 PRIMARY KEY(tenant_id,kind,id),
 FOREIGN KEY(tenant_id,referenced_load_kind,referenced_load_id) REFERENCES operations_private.resources(tenant_id,kind,id) DEFERRABLE INITIALLY IMMEDIATE,
 CHECK(jsonb_typeof(data)='object' AND data @> jsonb_build_object('id',id::text,'tenantId',tenant_id::text,'kind',kind,'version',version))
);
CREATE INDEX operations_resources_load ON operations_private.resources(tenant_id,referenced_load_kind,referenced_load_id);
CREATE UNIQUE INDEX operations_active_load_assignment ON operations_private.resources(tenant_id,(data->>'loadId')) WHERE kind='assignment' AND data->>'status'='active';
CREATE UNIQUE INDEX operations_active_driver_assignment ON operations_private.resources(tenant_id,(data->>'driverId')) WHERE kind='assignment' AND data->>'status'='active';
CREATE UNIQUE INDEX operations_active_vehicle_assignment ON operations_private.resources(tenant_id,(data->>'vehicleId')) WHERE kind='assignment' AND data->>'status'='active';
CREATE UNIQUE INDEX operations_checkpoint_evidence ON operations_private.resources(tenant_id,kind,(data->>'jobId'),(data->>'runNumber'),(data->>'checkpoint')) WHERE kind IN ('agentdecision','connectorresult');
CREATE TABLE operations_private.commands (
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL, key uuid NOT NULL, digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), result jsonb NOT NULL,
 PRIMARY KEY(tenant_id,actor_id,key), FOREIGN KEY(tenant_id,actor_id) REFERENCES operations_private.users(tenant_id,id)
);
CREATE TABLE operations_private.audit (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id uuid NOT NULL UNIQUE,
 tenant_id uuid NOT NULL REFERENCES operations_private.tenants(id), actor_id uuid NOT NULL,
 action text NOT NULL, resource_id uuid, at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL CHECK(outcome IN ('success','denied','failure')), detail jsonb NOT NULL CHECK(jsonb_typeof(detail)='object'),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES operations_private.users(tenant_id,id)
);
CREATE INDEX operations_audit_tenant_sequence ON operations_private.audit(tenant_id,sequence DESC);
CREATE INDEX operations_audit_actor ON operations_private.audit(tenant_id,actor_id);
-- SECURITY INVOKER and fixed pg_catalog search path; never an owner-privilege workaround.
CREATE FUNCTION operations_private.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
BEGIN
 RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Append-only operations evidence';
END;
$function$;
REVOKE ALL ON FUNCTION operations_private.reject_mutation() FROM PUBLIC;
CREATE TRIGGER operations_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON operations_private.audit
FOR EACH STATEMENT EXECUTE FUNCTION operations_private.reject_mutation();
CREATE TRIGGER operations_commands_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON operations_private.commands
FOR EACH STATEMENT EXECUTE FUNCTION operations_private.reject_mutation();
CREATE TRIGGER operations_evidence_immutable BEFORE UPDATE OR DELETE ON operations_private.resources
FOR EACH ROW WHEN (OLD.kind IN ('agentdecision','connectorresult','pod','deliveryevent','measurement','governanceexport','consentrecord','integrationreceipt','providerrecommendation'))
EXECUTE FUNCTION operations_private.reject_mutation();
CREATE TRIGGER operations_resources_no_truncate BEFORE TRUNCATE ON operations_private.resources
FOR EACH STATEMENT EXECUTE FUNCTION operations_private.reject_mutation();

ALTER TABLE operations_private.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_tenant_read ON operations_private.tenants FOR SELECT USING (id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY tenants_tenant_insert ON operations_private.tenants FOR INSERT WITH CHECK (id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY tenants_tenant_update ON operations_private.tenants FOR UPDATE USING (id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL) WITH CHECK (id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

ALTER TABLE operations_private.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_read ON operations_private.users FOR SELECT USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY users_tenant_insert ON operations_private.users FOR INSERT WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY users_tenant_update ON operations_private.users FOR UPDATE USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL) WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

ALTER TABLE operations_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_read ON operations_private.sessions FOR SELECT USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY sessions_tenant_insert ON operations_private.sessions FOR INSERT WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY sessions_tenant_update ON operations_private.sessions FOR UPDATE USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL) WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

ALTER TABLE operations_private.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.resources FORCE ROW LEVEL SECURITY;
CREATE POLICY resources_tenant_read ON operations_private.resources FOR SELECT USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY resources_tenant_insert ON operations_private.resources FOR INSERT WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY resources_tenant_update ON operations_private.resources FOR UPDATE USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL) WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

ALTER TABLE operations_private.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.commands FORCE ROW LEVEL SECURITY;
CREATE POLICY commands_tenant_read ON operations_private.commands FOR SELECT USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY commands_tenant_insert ON operations_private.commands FOR INSERT WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

ALTER TABLE operations_private.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.audit FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_read ON operations_private.audit FOR SELECT USING (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);
CREATE POLICY audit_tenant_insert ON operations_private.audit FOR INSERT WITH CHECK (tenant_id=(SELECT nullif(current_setting('iway.tenant_id',true),'')::uuid) AND (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) IS NOT NULL);

-- No DELETE policy: deactivate/revoke records. RLS does not protect TRUNCATE, so no runtime role receives it.
REVOKE ALL ON ALL TABLES IN SCHEMA operations_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA operations_private FROM PUBLIC;
-- Standalone local PostgreSQL may lack these Supabase roles. Revoke if present; never create them.
DO $block$
DECLARE client_role text;
BEGIN
 FOREACH client_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=client_role) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA operations_private FROM %I',client_role);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA operations_private FROM %I',client_role);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA operations_private FROM %I',client_role);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA operations_private FROM %I',client_role);
  END IF;
 END LOOP;
END;
$block$;
COMMIT;
