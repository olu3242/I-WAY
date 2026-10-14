-- Bind evidence and sessions to the authenticated actor as well as the tenant.
BEGIN;
CREATE POLICY commands_actor ON operations_private.commands AS RESTRICTIVE
 FOR ALL USING (actor_id = nullif(current_setting('iway.actor_id',true),'')::uuid)
 WITH CHECK (actor_id = nullif(current_setting('iway.actor_id',true),'')::uuid);
CREATE POLICY audit_actor_insert ON operations_private.audit AS RESTRICTIVE
 FOR INSERT WITH CHECK (actor_id = nullif(current_setting('iway.actor_id',true),'')::uuid);
CREATE POLICY sessions_actor ON operations_private.sessions AS RESTRICTIVE
 FOR ALL USING (user_id = nullif(current_setting('iway.actor_id',true),'')::uuid)
 WITH CHECK (user_id = nullif(current_setting('iway.actor_id',true),'')::uuid);
COMMIT;
