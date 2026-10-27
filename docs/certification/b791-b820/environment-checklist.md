# B791–B820 owner configuration checklist

Target: isolated staging project `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, genuine Preview. This report contains names and validation requirements only. 13/13 names are present, but presence does not validate values or grant database ownership. No values were decrypted for this hosted audit.

| Name | Preview presence | Required validation |
|---|---|---|
| IWAY_AUTH_ENABLED | PRESENT | Exact true; owner approval required |
| IWAY_AUTH_SCHEMA_APPROVED | PRESENT | Exact b512-v4 |
| IWAY_STAGING_VERCEL_PROJECT_ID | PRESENT | Exact staging project; match genuine VERCEL_PROJECT_ID |
| IWAY_AUTH_ORIGIN | PRESENT | Exact HTTPS origin; no credentials, path, query or fragment |
| IWAY_AUTH_APPROVED_ORIGIN | PRESENT | Exact match to IWAY_AUTH_ORIGIN |
| IWAY_AUTH_DATABASE_URL | PRESENT | Pinned PostgreSQL project/database; iway_auth_runtime LOGIN; verified TLS; session port 5432 |
| IWAY_AUTH_PROVIDER | PRESENT | Exact google |
| IWAY_SUPABASE_PUBLISHABLE_KEY | PRESENT | Publishable key or pinned-project anon compatibility key; never service-role/secret key |
| IWAY_SESSION_ENCRYPTION_KEY | PRESENT | Canonical 43-character base64url 32-byte key; server only |
| IWAY_UAT_ENABLED | PRESENT | Exact true; owner approval required |
| IWAY_UAT_SCHEMA_APPROVED | PRESENT | Exact b574-candidate-v1 |
| IWAY_UAT_DATABASE_URL | PRESENT | Pinned PostgreSQL project/database; iway_uat_runtime LOGIN; verified TLS; session port 5432 |
| IWAY_OPERATIONS_DATABASE_URL | PRESENT | Pinned PostgreSQL project/database; iway_operations_runtime LOGIN; verified TLS; explicit port 5432; password at least 12 characters |

`SUPABASE_SERVICE_ROLE_KEY` is configured for Preview and violates the application-project policy; owner review is required before removal from that exact scope. Do not modify Production entries. Local private-file validation reports eight missing activation/approval/public-key/encryption names; local connection names alone do not authorize the excluded database. `IWAY_CONSENT_VERSION` is empty locally and absent from the inspected staging names; it belongs to public registration, outside the Operations package. Legacy direct OAuth client names do not certify current Supabase provider configuration. The exact callback, approved origin, actual restricted login/TLS/RLS, real identities/MFA, provider delivery and target ownership remain blocked. See [hosted gate](hosted-gate.md).
