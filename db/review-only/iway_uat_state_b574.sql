-- REVIEW ONLY. New proposed staging broker role, schema and grants require approval.
-- This file is NOT a migration and is NEVER applied to a linked/hosted database by tooling.
-- Precondition: iway_uat_runtime is a separate LOGIN, NOSUPERUSER NOBYPASSRLS
-- NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION role, with no elevated memberships.
BEGIN;
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
COMMIT;
