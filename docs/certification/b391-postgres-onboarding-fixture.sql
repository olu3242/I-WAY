-- B391: isolated PostgreSQL onboarding schema proposal.
-- Apply ONLY to disposable PostgreSQL fixture after security review.
-- No production migration, credentials or provisioning grants.
BEGIN;
CREATE SCHEMA IF NOT EXISTS operations_onboarding;
REVOKE ALL ON SCHEMA operations_onboarding FROM PUBLIC;
CREATE TABLE operations_onboarding.invitations (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 creator_id uuid NOT NULL,
 recipient text NOT NULL,
 assignment jsonb NOT NULL,
 issuer text NOT NULL,
 subject_hash text NOT NULL CHECK (length(subject_hash)=64),
 token_hash text UNIQUE CHECK (token_hash IS NULL OR length(token_hash)=64),
 state text NOT NULL CHECK (state IN ('CREATED','SENT','OPENED','VERIFIED','ACCEPTED','ACTIVE','EXPIRED','REVOKED','REJECTED','FAILED')),
 expires_at timestamptz NOT NULL,
 user_id uuid,
 send_count integer NOT NULL DEFAULT 0 CHECK (send_count BETWEEN 0 AND 5),
 last_sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(assignment)='object')
);
CREATE UNIQUE INDEX invitation_pending_recipient ON operations_onboarding.invitations (lower(recipient)) WHERE state IN ('CREATED','SENT','OPENED','VERIFIED','FAILED');
CREATE TABLE operations_onboarding.delivery_requests (
 invitation_id uuid NOT NULL REFERENCES operations_onboarding.invitations(id),
 request_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(invitation_id,request_key)
);
CREATE TABLE operations_onboarding.invitation_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 invitation_id uuid NOT NULL REFERENCES operations_onboarding.invitations(id),
 actor_id uuid,
 event_type text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE operations_onboarding.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.delivery_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.invitation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.invitation_events FORCE ROW LEVEL SECURITY;
-- Deliberately no access policies or application grants. Fail closed until
-- a reviewed restricted role and transaction-scoped tenant context exist.
REVOKE ALL ON ALL TABLES IN SCHEMA operations_onboarding FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA operations_onboarding FROM PUBLIC;
COMMIT;
