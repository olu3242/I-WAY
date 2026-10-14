-- Requires the already verified iway_registration role and INSERT policy.
-- PostgreSQL 16+ supports per-membership INHERIT / SET options.
-- Run with an authorized migration identity, never the application identity.
BEGIN;
DO $$
BEGIN
 IF current_setting('server_version_num')::integer < 160000 THEN
  RAISE EXCEPTION 'Registration login requires PostgreSQL 16 or later';
 END IF;
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'iway_registration'
     AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
     AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN
  RAISE EXCEPTION 'Verified non-login iway_registration role is required';
 END IF;
 IF EXISTS (SELECT FROM pg_auth_members WHERE member = 'iway_registration'::regrole) THEN
  RAISE EXCEPTION 'iway_registration must not inherit other roles';
 END IF;
 IF NOT EXISTS (SELECT FROM pg_class WHERE oid = 'iway_private.early_access_leads'::regclass
     AND relrowsecurity AND relowner <> 'iway_registration'::regrole) THEN
  RAISE EXCEPTION 'Existing private table must enforce RLS and have a separate owner';
 END IF;
 IF NOT has_schema_privilege('iway_registration', 'iway_private', 'USAGE')
    OR has_schema_privilege('iway_registration', 'iway_private', 'CREATE')
    OR NOT has_table_privilege('iway_registration', 'iway_private.early_access_leads', 'INSERT')
    OR has_any_column_privilege('iway_registration', 'iway_private.early_access_leads', 'SELECT')
    OR has_any_column_privilege('iway_registration', 'iway_private.early_access_leads', 'UPDATE')
    OR has_table_privilege('iway_registration', 'iway_private.early_access_leads', 'DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
  RAISE EXCEPTION 'Expected existing insert-only privileges; review role before proceeding';
 END IF;
 IF NOT EXISTS (SELECT FROM pg_policy WHERE polrelid = 'iway_private.early_access_leads'::regclass
     AND polcmd = 'a' AND 'iway_registration'::regrole::oid = ANY(polroles)) THEN
  RAISE EXCEPTION 'Existing iway_registration INSERT policy is required';
 END IF;
END $$;
-- Intentionally fail if this identity already exists: do not repurpose a role.
-- No password is stored here. Provision its password through a secure admin channel.
CREATE ROLE iway_registration_login LOGIN INHERIT
 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT iway_registration TO iway_registration_login
 WITH INHERIT TRUE, SET FALSE, ADMIN FALSE;
ALTER ROLE iway_registration_login SET search_path = pg_catalog;
COMMIT;
