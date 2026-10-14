-- Apply using a dedicated migration role, never from the public browser.
CREATE TABLE IF NOT EXISTS early_access_leads (
 id UUID PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 email VARCHAR(254) NOT NULL,
 email_hash CHAR(64) NOT NULL UNIQUE,
 company VARCHAR(120) NOT NULL DEFAULT '',
 role VARCHAR(16) NOT NULL CHECK (role IN ('driver','carrier','fleet','other')),
 consent BOOLEAN NOT NULL CHECK (consent = TRUE),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON early_access_leads FROM PUBLIC;
CREATE INDEX IF NOT EXISTS early_access_leads_created_at_idx ON early_access_leads(created_at);
