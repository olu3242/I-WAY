CREATE SCHEMA IF NOT EXISTS iway_private;

REVOKE ALL ON SCHEMA iway_private FROM PUBLIC;
REVOKE ALL ON SCHEMA iway_private FROM anon;
REVOKE ALL ON SCHEMA iway_private FROM authenticated;

CREATE TABLE IF NOT EXISTS iway_private.early_access_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    email_hash CHAR(64) NOT NULL UNIQUE,
    company VARCHAR(120) NOT NULL DEFAULT '',
    role VARCHAR(16) NOT NULL
        CHECK (role IN ('driver', 'carrier', 'fleet', 'other')),
    consent BOOLEAN NOT NULL CHECK (consent = TRUE),
    consent_version VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE iway_private.early_access_leads
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA iway_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA iway_private FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA iway_private FROM authenticated;

CREATE INDEX IF NOT EXISTS early_access_leads_created_idx
ON iway_private.early_access_leads(created_at);
