-- B460 review-only staging migration. NOT applied to hosted Supabase.
-- Apply only through an approved, audited migration workflow after checking existing schema.
-- Tables are private; server connection must use a deliberately authorized database role.
BEGIN;
CREATE SCHEMA IF NOT EXISTS iway_private;
CREATE TABLE IF NOT EXISTS iway_private.auth_pkce_transactions (
 state_hash text PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
 verifier text NOT NULL CHECK (length(verifier) BETWEEN 40 AND 128),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS iway_private.auth_server_sessions (
 session_hash text PRIMARY KEY CHECK (session_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 access_token text NOT NULL,
 refresh_token text NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT iway_encrypted_access CHECK (access_token LIKE 'v1.%'),
 CONSTRAINT iway_encrypted_refresh CHECK (refresh_token LIKE 'v1.%')
);
CREATE INDEX IF NOT EXISTS iway_pkce_expiry_idx ON iway_private.auth_pkce_transactions(expires_at);
CREATE INDEX IF NOT EXISTS iway_sessions_expiry_idx ON iway_private.auth_server_sessions(expires_at);
ALTER TABLE iway_private.auth_pkce_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.auth_pkce_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE iway_private.auth_server_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iway_private.auth_server_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON iway_private.auth_pkce_transactions FROM PUBLIC,anon,authenticated;
REVOKE ALL ON iway_private.auth_server_sessions FROM PUBLIC,anon,authenticated;
COMMIT;
