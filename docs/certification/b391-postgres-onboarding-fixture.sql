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
-- B395 fixture-only account and tenant binding persistence. No application grants.
CREATE TABLE operations_onboarding.provisioned_accounts (
 id uuid PRIMARY KEY,
 issuer text NOT NULL,
 subject_hash text NOT NULL CHECK(length(subject_hash)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(issuer,subject_hash)
);
CREATE TABLE operations_onboarding.tenant_role_bindings (
 tenant_id uuid NOT NULL,
 account_id uuid NOT NULL REFERENCES operations_onboarding.provisioned_accounts(id),
 role text NOT NULL CHECK(role IN ('carrier','fleet','driver','platform')),
 invitation_id uuid NOT NULL UNIQUE REFERENCES operations_onboarding.invitations(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,role)
);
-- B417 durable reconciliation intent; fixture-only, no application grants.
CREATE TABLE operations_onboarding.nonce_cleanup_jobs (
 invitation_id uuid PRIMARY KEY REFERENCES operations_onboarding.invitations(id),
 tenant_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','COMPLETE')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 lease_owner uuid,
 lease_until timestamptz,
 last_attempt_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE operations_onboarding.nonce_cleanup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.nonce_cleanup_jobs FORCE ROW LEVEL SECURITY;
-- B397 single-use proof ledger. Insert and provisioning must share a transaction.
CREATE TABLE operations_onboarding.identity_proof_uses (
 proof_hash text PRIMARY KEY CHECK(length(proof_hash)=64),
 invitation_id uuid NOT NULL REFERENCES operations_onboarding.invitations(id),
 tenant_id uuid NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE operations_onboarding.identity_proof_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.identity_proof_uses FORCE ROW LEVEL SECURITY;
-- Experimental server-issued nonce challenge, consumed once per invitation.
CREATE TABLE operations_onboarding.identity_nonce_challenges (
 nonce_hash text PRIMARY KEY CHECK(length(nonce_hash)=64),
 invitation_id uuid NOT NULL REFERENCES operations_onboarding.invitations(id),
 tenant_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- B409: at most one unconsumed challenge per invitation. An expired row
-- must be consumed or retired transactionally before a new challenge is issued.
CREATE UNIQUE INDEX identity_nonce_one_active_per_invitation
 ON operations_onboarding.identity_nonce_challenges(invitation_id)
 WHERE consumed_at IS NULL;
ALTER TABLE operations_onboarding.identity_nonce_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.identity_nonce_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.provisioned_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.provisioned_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.tenant_role_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_onboarding.tenant_role_bindings FORCE ROW LEVEL SECURITY;
-- Append-only event history: even the owner must not mutate or delete audit rows.
CREATE FUNCTION operations_onboarding.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $audit_guard$
BEGIN
 RAISE EXCEPTION 'INVITATION_AUDIT_IMMUTABLE' USING ERRCODE = '42501';
END;
$audit_guard$;
REVOKE ALL ON FUNCTION operations_onboarding.reject_event_mutation() FROM PUBLIC;
CREATE TRIGGER invitation_events_immutable BEFORE UPDATE OR DELETE ON operations_onboarding.invitation_events
FOR EACH ROW EXECUTE FUNCTION operations_onboarding.reject_event_mutation();
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
