-- Read-only preflight. Run only with --project-ref vnoxdinldneeczxibicp.
-- Inspect catalog metadata only; never select registration rows or credentials.
SELECT json_build_object(
 'roles', (SELECT json_agg(json_build_object(
   'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypass_rls',rolbypassrls,
   'create_role',rolcreaterole,'create_db',rolcreatedb,'replication',rolreplication))
   FROM pg_roles WHERE rolname IN ('iway_registration','iway_registration_login')),
 'memberships', (SELECT json_agg(json_build_object(
   'member',member_role.rolname,'parent',parent_role.rolname,
   'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option))
   FROM pg_auth_members m JOIN pg_roles member_role ON member_role.oid=m.member
   JOIN pg_roles parent_role ON parent_role.oid=m.roleid
   WHERE member_role.rolname IN ('iway_registration','iway_registration_login')),
 'table', (SELECT json_build_object('rls',relrowsecurity,
   'app_owns_table',relowner IN (SELECT oid FROM pg_roles WHERE rolname IN ('iway_registration','iway_registration_login')))
   FROM pg_class WHERE oid='iway_private.early_access_leads'::regclass),
 'privileges', (SELECT json_agg(json_build_object('role',rolname,
   'schema_usage',has_schema_privilege(oid,'iway_private','USAGE'),
   'schema_create',has_schema_privilege(oid,'iway_private','CREATE'),
   'insert',has_table_privilege(oid,'iway_private.early_access_leads','INSERT'),
   'select',has_any_column_privilege(oid,'iway_private.early_access_leads','SELECT'),
   'update',has_any_column_privilege(oid,'iway_private.early_access_leads','UPDATE'),
   'delete',has_table_privilege(oid,'iway_private.early_access_leads','DELETE'),
   'other_write',has_table_privilege(oid,'iway_private.early_access_leads','TRUNCATE,REFERENCES,TRIGGER')))
   FROM pg_roles WHERE rolname IN ('iway_registration','iway_registration_login','anon','authenticated')),
 'public_schema_grants', (SELECT count(*) FROM pg_namespace n,
   LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
   WHERE n.nspname='iway_private' AND a.grantee=0),
 'public_table_grants', (SELECT count(*) FROM pg_class c,
   LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
   WHERE c.oid='iway_private.early_access_leads'::regclass AND a.grantee=0),
 'public_column_grants', (SELECT count(*) FROM pg_attribute att,
   LATERAL aclexplode(att.attacl) a
   WHERE att.attrelid='iway_private.early_access_leads'::regclass AND a.grantee=0),
 'registration_insert_policy', (SELECT count(*) FROM pg_policy p
   WHERE p.polrelid='iway_private.early_access_leads'::regclass AND p.polcmd='a'
   AND EXISTS(SELECT FROM pg_roles r WHERE r.rolname='iway_registration' AND r.oid=ANY(p.polroles)))
) AS registration_preflight;
