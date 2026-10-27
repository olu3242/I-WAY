-- REVIEW ONLY: owner approval required before any hosted application.
-- Separate management metadata role; NOT one of the three application runtimes.
-- Pre-existing role: iway_uat_management_runtime LOGIN NOSUPERUSER NOBYPASSRLS
-- NOCREATEROLE NOCREATEDB NOINHERIT NOREPLICATION; no memberships or ownership.
BEGIN;
CREATE SCHEMA iway_uat_management_private;
REVOKE ALL ON SCHEMA iway_uat_management_private FROM PUBLIC;
CREATE TABLE iway_uat_management_private.commands(
 key text PRIMARY KEY CHECK(key ~ '^[a-f0-9]{64}$'),fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 actor_id uuid NOT NULL,user_id uuid NOT NULL,nonce uuid NOT NULL UNIQUE,
 expires bigint NOT NULL,created bigint NOT NULL,finished bigint,
 status text NOT NULL CHECK(status IN ('claimed','completed','uncertain')),
 CHECK(expires>created),CHECK((status='claimed')=(finished IS NULL))
);
-- One unresolved operation per canonical user, across processes and administrators.
CREATE UNIQUE INDEX management_target_fence ON iway_uat_management_private.commands(user_id) WHERE status IN ('claimed','uncertain');
CREATE TABLE iway_uat_management_private.audit(id uuid PRIMARY KEY,actor_id uuid NOT NULL,user_id uuid NOT NULL,event text NOT NULL CHECK(event IN ('command.claimed','command.completed','command.uncertain')),command_hash text NOT NULL REFERENCES iway_uat_management_private.commands(key),at bigint NOT NULL);
ALTER TABLE iway_uat_management_private.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_management_private.commands FORCE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_management_private.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_uat_management_private.audit FORCE ROW LEVEL SECURITY;
CREATE POLICY management_commands ON iway_uat_management_private.commands TO iway_uat_management_runtime
 USING(actor_id::text=current_setting('iway.management_actor',true)) WITH CHECK(actor_id::text=current_setting('iway.management_actor',true));
CREATE POLICY management_audit ON iway_uat_management_private.audit FOR INSERT TO iway_uat_management_runtime
 WITH CHECK(actor_id::text=current_setting('iway.management_actor',true));
CREATE FUNCTION iway_uat_management_private.terminal_command() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'UPDATE' OR OLD.status<>'claimed' OR NEW.status NOT IN ('completed','uncertain') THEN RAISE EXCEPTION 'MANAGEMENT_COMMAND_IMMUTABLE'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER command_terminal BEFORE UPDATE OR DELETE ON iway_uat_management_private.commands FOR EACH ROW EXECUTE FUNCTION iway_uat_management_private.terminal_command();
CREATE FUNCTION iway_uat_management_private.immutable_audit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'MANAGEMENT_AUDIT_IMMUTABLE'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON iway_uat_management_private.audit FOR EACH STATEMENT EXECUTE FUNCTION iway_uat_management_private.immutable_audit();
REVOKE ALL ON ALL TABLES IN SCHEMA iway_uat_management_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iway_uat_management_private FROM PUBLIC;
GRANT USAGE ON SCHEMA iway_uat_management_private TO iway_uat_management_runtime;
GRANT SELECT,INSERT ON iway_uat_management_private.commands TO iway_uat_management_runtime;
GRANT UPDATE(status,finished) ON iway_uat_management_private.commands TO iway_uat_management_runtime;
GRANT INSERT ON iway_uat_management_private.audit TO iway_uat_management_runtime;
COMMIT;
