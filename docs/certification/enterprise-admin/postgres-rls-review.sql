-- REVIEW-ONLY: do not apply to hosted production without approved restricted role and certification.
-- Tenant context is set by the verified operations PostgreSQL transaction adapter.
BEGIN;
CREATE TABLE IF NOT EXISTS operations_private.organization_admin(
 tenant_id uuid NOT NULL REFERENCES operations_private.tenants(id),
 kind text NOT NULL CHECK(kind IN ('settings','permission-set','field-security','validation-rule','related-tab','page-layout','business-unit','location')),
 id text NOT NULL CHECK(length(id) BETWEEN 1 AND 128),
 version integer NOT NULL CHECK(version>=1),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 PRIMARY KEY(tenant_id,kind,id)
);
CREATE INDEX IF NOT EXISTS organization_admin_kind_scope ON operations_private.organization_admin(tenant_id,kind);
ALTER TABLE operations_private.organization_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.organization_admin FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_admin_tenant_scope ON operations_private.organization_admin
 AS RESTRICTIVE FOR ALL
 USING(tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM operations_private.users u WHERE u.tenant_id=tenant_id AND u.id=nullif(current_setting('iway.actor_id',true),'')::uuid AND u.data->>'active'='true' AND u.data->>'role'='carrier'))
 WITH CHECK(tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM operations_private.users u WHERE u.tenant_id=tenant_id AND u.id=nullif(current_setting('iway.actor_id',true),'')::uuid AND u.data->>'active'='true' AND u.data->>'role'='carrier'));
-- RESTRICTIVE policy must be paired with a permissive grant policy, scoped to same tenant.
CREATE POLICY organization_admin_permit ON operations_private.organization_admin
 FOR ALL USING(tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid);
CREATE TABLE IF NOT EXISTS operations_private.organization_admin_audit(
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 kind text NOT NULL,
 item_id text NOT NULL,
 operation text NOT NULL,
 version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE operations_private.organization_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_private.organization_admin_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_admin_audit_select ON operations_private.organization_admin_audit
 FOR SELECT USING(tenant_id=nullif(current_setting('iway.tenant_id',true),'')::uuid AND actor_id=nullif(current_setting('iway.actor_id',true),'')::uuid);
-- No INSERT/UPDATE/DELETE grants to app roles until independently certified.
REVOKE ALL ON operations_private.organization_admin,operations_private.organization_admin_audit FROM PUBLIC,anon,authenticated;
COMMIT;
