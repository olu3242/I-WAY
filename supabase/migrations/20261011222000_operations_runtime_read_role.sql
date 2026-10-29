-- Dedicated UAT runtime read role. This is not an identity/provisioning role.
-- Application transaction context MUST be set by trusted server code after auth;
-- do not expose direct SQL access or allow clients to choose iway.* settings.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_operations_runtime') THEN
    CREATE ROLE iway_operations_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_operations_runtime'
    AND NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN
    RAISE EXCEPTION 'Unsafe existing iway_operations_runtime role';
  END IF;
END $$;
GRANT USAGE ON SCHEMA operations_private TO iway_operations_runtime;
GRANT SELECT ON operations_private.tenants, operations_private.users,
  operations_private.sessions, operations_private.resources,
  operations_private.commands, operations_private.audit,
  operations_private.dispatcher_directory TO iway_operations_runtime;
-- No INSERT/UPDATE/DELETE/TRUNCATE, role memberships or login credentials.
COMMIT;
