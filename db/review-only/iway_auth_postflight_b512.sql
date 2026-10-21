-- Run as iway_auth_runtime after approved migration. No table data or secrets returned.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT current_user,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,rolreplication
 FROM pg_roles WHERE rolname=current_user;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege(current_user,c.oid,'SELECT') AS can_read,
 has_table_privilege(current_user,c.oid,'INSERT,UPDATE') AS can_write,
 has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES') AS excessive
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relkind='r';
SELECT c.relname,conname,pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relname LIKE 'auth_%';
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='iway_private';
COMMIT;
-- Executable acceptance additionally requires assertAuthDatabaseReady, then the restricted-role integration suite.
