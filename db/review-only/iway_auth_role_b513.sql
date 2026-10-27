-- REVIEW ONLY: administrative approval required. No password literal or grant membership.
-- Configure a SCRAM credential via the approved secret manager after review, never in this file.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='10s';
DO $role$ DECLARE r record; BEGIN
 SELECT * INTO r FROM pg_roles WHERE rolname='iway_auth_runtime';
 IF NOT FOUND THEN
  CREATE ROLE iway_auth_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD NULL;
 ELSE
  IF r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication OR NOT r.rolcanlogin
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)
  THEN RAISE EXCEPTION 'AUTH_ROLE_UNREVIEWED_EXISTING_ROLE'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime'))
  OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname='iway_auth_runtime'))
  OR has_schema_privilege('iway_auth_runtime','public','CREATE')
 THEN RAISE EXCEPTION 'AUTH_ROLE_UNREVIEWED_OWNERSHIP_OR_PUBLIC_CREATE'; END IF;
END $role$;
-- Table privileges are granted only by the separately reviewed B512 schema migration.
COMMIT;
