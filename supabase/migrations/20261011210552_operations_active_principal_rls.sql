-- OFFLINE until reviewed and deployed. Local certification applies this only to a new disposable cluster.
-- The current async scope exposes the authenticated principal only. Account administration is unsupported.
BEGIN;
CREATE POLICY users_active_self ON operations_private.users AS RESTRICTIVE
 FOR ALL USING (id = (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) AND data->>'active'='true')
 WITH CHECK (id = (SELECT nullif(current_setting('iway.actor_id',true),'')::uuid) AND data->>'active'='true');
DO $block$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['tenants','sessions','resources','commands','audit'] LOOP
  EXECUTE format('CREATE POLICY active_principal ON operations_private.%I AS RESTRICTIVE FOR ALL USING (EXISTS (SELECT 1 FROM operations_private.users WHERE tenant_id = nullif(current_setting(''iway.tenant_id'',true),'''')::uuid AND id = nullif(current_setting(''iway.actor_id'',true),'''')::uuid AND data->>''active''=''true'')) WITH CHECK (EXISTS (SELECT 1 FROM operations_private.users WHERE tenant_id = nullif(current_setting(''iway.tenant_id'',true),'''')::uuid AND id = nullif(current_setting(''iway.actor_id'',true),'''')::uuid AND data->>''active''=''true''))', table_name);
 END LOOP;
END;
$block$;
COMMIT;
