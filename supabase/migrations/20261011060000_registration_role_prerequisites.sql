-- UAT prerequisite: establish an insert-only, non-login registration role.
-- Must run after early_access and before registration_login.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iway_registration') THEN
    CREATE ROLE iway_registration NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'iway_registration'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
  ) THEN
    RAISE EXCEPTION 'Existing iway_registration role is not least-privileged';
  END IF;
END $$;
GRANT USAGE ON SCHEMA iway_private TO iway_registration;
GRANT INSERT ON TABLE iway_private.early_access_leads TO iway_registration;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE iway_private.early_access_leads FROM iway_registration;
DROP POLICY IF EXISTS early_access_registration_insert ON iway_private.early_access_leads;
CREATE POLICY early_access_registration_insert ON iway_private.early_access_leads
  FOR INSERT TO iway_registration WITH CHECK (consent IS TRUE);
COMMIT;
