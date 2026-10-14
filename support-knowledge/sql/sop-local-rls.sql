-- LOCAL ISOLATED CERTIFICATION ONLY. Never apply to hosted automatically.
-- Execute after sop-local-schema.sql as an administrator on a disposable DB.
-- The app must use a dedicated LOGIN role that is not owner, superuser or BYPASSRLS.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_sop_runtime') THEN
  CREATE ROLE iway_sop_runtime NOLOGIN NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA iway_private TO iway_sop_runtime;
GRANT SELECT ON iway_private.sop_articles TO iway_sop_runtime;
GRANT SELECT,INSERT,UPDATE ON iway_private.sop_tickets TO iway_sop_runtime;
GRANT INSERT ON iway_private.sop_ticket_events TO iway_sop_runtime;
GRANT USAGE ON SEQUENCE iway_private.sop_ticket_events_id_seq TO iway_sop_runtime;
-- Transaction-local context must be bound from a trusted, server-verified session.
-- Custom GUC values alone are not an authentication mechanism; direct SQL access
-- to this role is forbidden until a non-forgeable identity binding is implemented.
CREATE POLICY sop_articles_tenant_select ON iway_private.sop_articles
 FOR SELECT TO iway_sop_runtime
 USING (tenant_id = nullif(current_setting('iway.verified_tenant',true),''));
CREATE POLICY sop_tickets_tenant_select ON iway_private.sop_tickets
 FOR SELECT TO iway_sop_runtime
 USING (tenant_id = nullif(current_setting('iway.verified_tenant',true),''));
CREATE POLICY sop_tickets_tenant_insert ON iway_private.sop_tickets
 FOR INSERT TO iway_sop_runtime
 WITH CHECK (tenant_id = nullif(current_setting('iway.verified_tenant',true),'')
 AND requester_id = nullif(current_setting('iway.verified_actor',true),''));
CREATE POLICY sop_tickets_tenant_update ON iway_private.sop_tickets
 FOR UPDATE TO iway_sop_runtime
 USING (tenant_id = nullif(current_setting('iway.verified_tenant',true),''))
 WITH CHECK (tenant_id = nullif(current_setting('iway.verified_tenant',true),''));
CREATE POLICY sop_events_tenant_insert ON iway_private.sop_ticket_events
 FOR INSERT TO iway_sop_runtime
 WITH CHECK (tenant_id = nullif(current_setting('iway.verified_tenant',true),'')
 AND actor_id = nullif(current_setting('iway.verified_actor',true),''));
