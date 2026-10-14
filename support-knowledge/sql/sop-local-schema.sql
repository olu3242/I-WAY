-- LOCAL/REVIEW ONLY. Do not apply to hosted without explicit authorization.
-- Dedicated restricted application role must be provisioned separately.
CREATE SCHEMA IF NOT EXISTS iway_private;
REVOKE ALL ON SCHEMA iway_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS iway_private.sop_articles (
 id text PRIMARY KEY,
 tenant_id text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 status text NOT NULL CHECK (status IN ('draft','approved','retired')),
 authored_by text NOT NULL,
 approved_by text,
 version text NOT NULL,
 source text NOT NULL,
 allowed_roles text[],
 effective_at timestamptz,
 expires_at timestamptz,
 CHECK (approved_by IS NULL OR approved_by <> authored_by)
);
CREATE TABLE IF NOT EXISTS iway_private.sop_tickets (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 tenant_id text NOT NULL,
 requester_id text NOT NULL,
 subject varchar(300) NOT NULL,
 priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
 status text NOT NULL CHECK (status IN ('open','triaged','assigned','waiting_customer','resolved','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS iway_private.sop_ticket_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id text NOT NULL,
 ticket_id text NOT NULL REFERENCES iway_private.sop_tickets(id),
 actor_id text NOT NULL,
 from_status text NOT NULL,
 to_status text NOT NULL,
 note varchar(500) NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sop_articles_tenant_status_idx ON iway_private.sop_articles(tenant_id,status);
CREATE INDEX IF NOT EXISTS sop_tickets_tenant_status_idx ON iway_private.sop_tickets(tenant_id,status);
CREATE INDEX IF NOT EXISTS sop_events_tenant_ticket_idx ON iway_private.sop_ticket_events(tenant_id,ticket_id);
ALTER TABLE iway_private.sop_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.sop_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.sop_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.sop_articles FORCE ROW LEVEL SECURITY;
ALTER TABLE iway_private.sop_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE iway_private.sop_ticket_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON iway_private.sop_articles,iway_private.sop_tickets,iway_private.sop_ticket_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE iway_private.sop_ticket_events_id_seq FROM PUBLIC,anon,authenticated;
-- No policies or application grants: fail closed until verified tenant identity,
-- restricted DB role and transaction-local identity binding are certified.
