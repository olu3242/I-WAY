-- REVIEW ONLY: requires separately approved restricted LOGIN and schema application.
-- No role/credential, Auth identity, tenant, principal or deployment configuration is created.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('I-WAY durable engine v1',0));
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iway_operations_runtime' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolinherit)
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='iway_operations_runtime')) THEN RAISE EXCEPTION 'OPERATIONS_RESTRICTED_LOGIN_REQUIRED'; END IF;
END $role$;
CREATE SCHEMA IF NOT EXISTS operations_engine_private;
REVOKE ALL ON SCHEMA operations_engine_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS operations_engine_private.realms(
 tenant_id uuid PRIMARY KEY, governance boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS operations_engine_private.principals(
 tenant_id uuid NOT NULL REFERENCES operations_engine_private.realms(tenant_id), actor_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true, PRIMARY KEY(tenant_id,actor_id));
CREATE TABLE IF NOT EXISTS operations_engine_private.state(
 tenant_id uuid PRIMARY KEY REFERENCES operations_engine_private.realms(tenant_id), version bigint NOT NULL CHECK(version>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=33554432));
CREATE TABLE IF NOT EXISTS operations_engine_private.audit(
 tenant_id uuid NOT NULL REFERENCES operations_engine_private.realms(tenant_id), sequence bigint NOT NULL,
 entry jsonb NOT NULL CHECK(jsonb_typeof(entry)='object' AND entry->>'tenant_id'=tenant_id::text AND (entry->>'sequence')::bigint=sequence),
 PRIMARY KEY(tenant_id,sequence));
CREATE TABLE IF NOT EXISTS operations_engine_private.deployment_configuration(
 project_id text PRIMARY KEY, configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object'), approved boolean NOT NULL DEFAULT false);
ALTER TABLE operations_engine_private.realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.realms FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.principals ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.principals FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.state FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.audit FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.deployment_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_engine_private.deployment_configuration FORCE ROW LEVEL SECURITY;
-- Reapplying policies is transactional and preserves all data. No public/browser role access.
DROP POLICY IF EXISTS realm_scope ON operations_engine_private.realms;
CREATE POLICY realm_scope ON operations_engine_private.realms TO iway_operations_runtime USING(active AND (tenant_id::text=current_setting('iway.tenant_id',true) OR governance));
DROP POLICY IF EXISTS principal_scope ON operations_engine_private.principals;
CREATE POLICY principal_scope ON operations_engine_private.principals TO iway_operations_runtime USING(active AND tenant_id::text=current_setting('iway.tenant_id',true) AND actor_id::text=current_setting('iway.actor_id',true) AND EXISTS(SELECT 1 FROM operations_engine_private.realms r WHERE r.tenant_id=principals.tenant_id AND r.active));
DROP POLICY IF EXISTS state_scope ON operations_engine_private.state;
CREATE POLICY state_scope ON operations_engine_private.state TO iway_operations_runtime USING(
 tenant_id::text=current_setting('iway.tenant_id',true) AND EXISTS(SELECT 1 FROM operations_engine_private.principals p WHERE p.tenant_id=state.tenant_id AND p.actor_id::text=current_setting('iway.actor_id',true)))
 WITH CHECK(tenant_id::text=current_setting('iway.tenant_id',true) AND EXISTS(SELECT 1 FROM operations_engine_private.principals p WHERE p.tenant_id=state.tenant_id AND p.actor_id::text=current_setting('iway.actor_id',true)));
DROP POLICY IF EXISTS audit_scope ON operations_engine_private.audit;
CREATE POLICY audit_scope ON operations_engine_private.audit TO iway_operations_runtime USING(
 tenant_id::text=current_setting('iway.tenant_id',true) AND EXISTS(SELECT 1 FROM operations_engine_private.principals p WHERE p.tenant_id=audit.tenant_id AND p.actor_id::text=current_setting('iway.actor_id',true)))
 WITH CHECK(tenant_id::text=current_setting('iway.tenant_id',true) AND EXISTS(SELECT 1 FROM operations_engine_private.principals p WHERE p.tenant_id=audit.tenant_id AND p.actor_id::text=current_setting('iway.actor_id',true)));
DROP POLICY IF EXISTS deployment_scope ON operations_engine_private.deployment_configuration;
CREATE POLICY deployment_scope ON operations_engine_private.deployment_configuration TO iway_operations_runtime USING(approved AND project_id='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm');
REVOKE ALL ON ALL TABLES IN SCHEMA operations_engine_private FROM PUBLIC,iway_operations_runtime;
GRANT USAGE ON SCHEMA operations_engine_private TO iway_operations_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA operations_engine_private TO iway_operations_runtime;
GRANT UPDATE(payload,version) ON operations_engine_private.state TO iway_operations_runtime;
GRANT INSERT ON operations_engine_private.audit TO iway_operations_runtime;
COMMIT;
