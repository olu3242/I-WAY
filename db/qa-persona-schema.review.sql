-- QA persona sessions: private, server-only. Never expose via Data API.
CREATE SCHEMA IF NOT EXISTS iway_private;
CREATE TABLE IF NOT EXISTS iway_private.qa_persona_sessions (
 id uuid PRIMARY KEY,
 actor_id text NOT NULL,
 target_id text NOT NULL,
 tenant_id text NOT NULL,
 effective_role text NOT NULL CHECK (effective_role IN ('carrier','fleet','driver')),
 reason text NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 500),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '15 minutes')
);
CREATE INDEX IF NOT EXISTS qa_persona_sessions_actor_idx ON iway_private.qa_persona_sessions(actor_id,expires_at);
CREATE TABLE IF NOT EXISTS iway_private.qa_persona_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event text NOT NULL CHECK (event IN ('qa_persona_started','qa_persona_stopped')),
 actor_id text NOT NULL,
 effective_actor_id text NOT NULL,
 tenant_id text NOT NULL,
 session_id uuid NOT NULL REFERENCES iway_private.qa_persona_sessions(id),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iway_private.qa_persona_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.qa_persona_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA iway_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA iway_private FROM PUBLIC, anon, authenticated;
-- No client-facing policies. Grant narrowly to the dedicated trusted backend role
-- only after deployment-specific role review; do not use service-role keys in browsers.
