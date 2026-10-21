-- REVIEW ONLY. Never apply to hosted Supabase before catalog/retention approval.
-- Existing B460 draft revised for B490-B492. Run as approved migration owner, NOT runtime.
-- Provision iway_auth_runtime separately: NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_auth_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 THEN RAISE EXCEPTION 'Dedicated restricted iway_auth_runtime role must be provisioned first'; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS iway_private;
REVOKE ALL ON SCHEMA iway_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA iway_private TO iway_auth_runtime;
CREATE TABLE IF NOT EXISTS iway_private.auth_pkce_transactions (
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[0-9a-f]{64}$'),
 verifier text CHECK(verifier LIKE 'v1.%'),expires_at timestamptz NOT NULL,
 consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iway_private.auth_pkce_transactions ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
ALTER TABLE iway_private.auth_pkce_transactions ALTER COLUMN verifier DROP NOT NULL;
CREATE TABLE IF NOT EXISTS iway_private.auth_server_sessions (
 session_hash text PRIMARY KEY CHECK(session_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 access_token text CHECK(access_token LIKE 'v1.%'),refresh_token text CHECK(refresh_token LIKE 'v1.%'),
 expires_at timestamptz NOT NULL,access_expires_at timestamptz,
 revoked_at timestamptz,refresh_claim uuid,refresh_started_at timestamptz,
 token_version bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iway_private.auth_server_sessions ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;
ALTER TABLE iway_private.auth_server_sessions ADD COLUMN IF NOT EXISTS refresh_claim uuid;
ALTER TABLE iway_private.auth_server_sessions ADD COLUMN IF NOT EXISTS refresh_started_at timestamptz;
ALTER TABLE iway_private.auth_server_sessions ADD COLUMN IF NOT EXISTS token_version bigint NOT NULL DEFAULT 0;
ALTER TABLE iway_private.auth_server_sessions ALTER COLUMN access_token DROP NOT NULL;
ALTER TABLE iway_private.auth_server_sessions ALTER COLUMN refresh_token DROP NOT NULL;
-- Legacy rows lack a verified provider expiry: deactivate, do not guess one.
UPDATE iway_private.auth_server_sessions SET revoked_at=COALESCE(revoked_at,now()),access_token=NULL,refresh_token=NULL WHERE access_expires_at IS NULL;
ALTER TABLE iway_private.auth_server_sessions DROP CONSTRAINT IF EXISTS auth_server_sessions_user_id_fkey;
ALTER TABLE iway_private.auth_server_sessions ADD CONSTRAINT auth_server_sessions_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS iway_private.auth_tenants (tenant_id uuid PRIMARY KEY,active boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS iway_private.auth_tenant_roles (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,tenant_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('carrier','fleet','driver','platform')),
 granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 PRIMARY KEY(user_id,tenant_id,role)
);
ALTER TABLE iway_private.auth_tenant_roles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT false;
ALTER TABLE iway_private.auth_tenant_roles ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';
ALTER TABLE iway_private.auth_tenant_roles ADD COLUMN IF NOT EXISTS principal_id uuid;
ALTER TABLE iway_private.auth_tenant_roles ADD COLUMN IF NOT EXISTS fleet_id uuid;
ALTER TABLE iway_private.auth_tenant_roles DROP CONSTRAINT IF EXISTS auth_tenant_roles_user_id_fkey;
ALTER TABLE iway_private.auth_tenant_roles ADD CONSTRAINT auth_tenant_roles_user_id_fkey FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
-- A private authorization projection populated by approved business data provisioning.
-- No operational workflow mutation is granted to the auth runtime.
CREATE TABLE IF NOT EXISTS iway_private.auth_resources (
 resource_id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES iway_private.auth_tenants(tenant_id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('load','tracking','asset','driver','tenant-audit')),
 fleet_id uuid,driver_id uuid,active boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS iway_pkce_expiry_idx ON iway_private.auth_pkce_transactions(expires_at);
CREATE INDEX IF NOT EXISTS iway_sessions_expiry_idx ON iway_private.auth_server_sessions(expires_at);
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['auth_pkce_transactions','auth_server_sessions','auth_tenant_roles','auth_tenants','auth_resources'] LOOP
  EXECUTE format('ALTER TABLE iway_private.%I ENABLE ROW LEVEL SECURITY',relation);
  EXECUTE format('ALTER TABLE iway_private.%I FORCE ROW LEVEL SECURITY',relation);
  EXECUTE format('REVOKE ALL ON iway_private.%I FROM PUBLIC,anon,authenticated,iway_auth_runtime',relation);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON iway_private.auth_pkce_transactions,iway_private.auth_server_sessions TO iway_auth_runtime;
GRANT SELECT ON iway_private.auth_tenant_roles,iway_private.auth_tenants,iway_private.auth_resources TO iway_auth_runtime;
DROP POLICY IF EXISTS auth_runtime_pkce ON iway_private.auth_pkce_transactions;
CREATE POLICY auth_runtime_pkce ON iway_private.auth_pkce_transactions TO iway_auth_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS auth_runtime_sessions ON iway_private.auth_server_sessions;
CREATE POLICY auth_runtime_sessions ON iway_private.auth_server_sessions TO iway_auth_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS auth_runtime_roles ON iway_private.auth_tenant_roles;
CREATE POLICY auth_runtime_roles ON iway_private.auth_tenant_roles FOR SELECT TO iway_auth_runtime
 USING(user_id=NULLIF(current_setting('iway.user_id',true),'')::uuid AND active AND revoked_at IS NULL);
DROP POLICY IF EXISTS auth_runtime_tenants ON iway_private.auth_tenants;
CREATE POLICY auth_runtime_tenants ON iway_private.auth_tenants FOR SELECT TO iway_auth_runtime USING(active AND EXISTS(
 SELECT 1 FROM iway_private.auth_tenant_roles m WHERE m.tenant_id=auth_tenants.tenant_id));
DROP POLICY IF EXISTS auth_runtime_resources ON iway_private.auth_resources;
CREATE POLICY auth_runtime_resources ON iway_private.auth_resources FOR SELECT TO iway_auth_runtime USING(active AND EXISTS(
 SELECT 1 FROM iway_private.auth_tenants t WHERE t.tenant_id=auth_resources.tenant_id));
-- Runtime has no DELETE, DDL, role grant, provisioning, auth.users, or public-schema privileges from this migration.
-- Metadata is retained. consume/revoke/expiry erase encrypted secrets without hard-deleting rows.
-- Existing non-runtime policies/ACLs and role memberships require explicit preflight review.
COMMIT;
