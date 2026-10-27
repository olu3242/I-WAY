-- B446: private Supabase Auth user-to-tenant role bindings.
-- Staging migration proposal; do not apply to hosted production without approval.
create schema if not exists iway_private;
create table if not exists iway_private.auth_tenant_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  role text not null check (role in ('carrier','fleet','platform','driver')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id,tenant_id,role)
);
alter table iway_private.auth_tenant_roles enable row level security;
alter table iway_private.auth_tenant_roles force row level security;
revoke all on schema iway_private from public, anon, authenticated;
revoke all on all tables in schema iway_private from public, anon, authenticated;
-- No client policies. Only audited, server-side privileged provisioning may write.
-- Application APIs must validate auth.uid() and active role bindings before access.
