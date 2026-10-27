-- Minimal dispatcher identity projection. No names, login, hashes, grants or user JSON.
-- Maintained by the same trusted provisioning transaction as users; runtime has SELECT only.
BEGIN;
CREATE TABLE operations_private.dispatcher_directory (
 tenant_id uuid NOT NULL, id uuid NOT NULL, active boolean NOT NULL,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,id) REFERENCES operations_private.users(tenant_id,id)
);
INSERT INTO operations_private.dispatcher_directory
 SELECT tenant_id,id,data->>'active'='true' FROM operations_private.users WHERE data->>'role'='dispatcher';
CREATE FUNCTION operations_private.sync_dispatcher_directory() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $function$
BEGIN
 INSERT INTO operations_private.dispatcher_directory(tenant_id,id,active)
 VALUES(NEW.tenant_id,NEW.id,NEW.data->>'role'='dispatcher' AND NEW.data->>'active'='true')
 ON CONFLICT(tenant_id,id) DO UPDATE SET active=EXCLUDED.active;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION operations_private.sync_dispatcher_directory() FROM PUBLIC;
CREATE TRIGGER operations_dispatcher_directory_sync AFTER INSERT OR UPDATE OF data ON operations_private.users
 FOR EACH ROW EXECUTE FUNCTION operations_private.sync_dispatcher_directory();
ALTER TABLE operations_private.dispatcher_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.dispatcher_directory FORCE ROW LEVEL SECURITY;
CREATE POLICY dispatcher_directory_read ON operations_private.dispatcher_directory FOR SELECT
 USING (tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid AND active
 AND EXISTS(SELECT 1 FROM operations_private.users WHERE tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid
 AND id=nullif(current_setting('iway.actor_id',true),'')::uuid AND data->>'active'='true'
 AND data->>'role'='carrier' AND data->'permissions' ? 'load:create'));
REVOKE ALL ON operations_private.dispatcher_directory FROM PUBLIC;
COMMIT;
