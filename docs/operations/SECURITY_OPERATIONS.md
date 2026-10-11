# Security operations — local interfaces, separate hosted authorization

## Inventory and configuration
server/operations-security-readiness.mjs accepts an explicitly supplied configuration object and returns names, purposes and presence flags only. It never loads an environment file, returns values, emits raw parser errors, or verifies real authentication. DATABASE_URL must remain the dedicated restricted registration connection; it is not the operations persistence credential. Owner-password and service-role entries are administrative-only and prohibited for application fallback.

Existing registration configuration validation remains authoritative. A syntactically accepted consent version is not evidence of legal approval. Production defaults, TLS certificate verification and hostname checks are not weakened.

## Exposed credential rotation — unresolved
The previously exposed owner password and service-role key require rotation by an authorized operator through the trusted Supabase dashboard. Do not copy values into chat, logs, screenshots, commits, shell history or tickets. No credential was inspected or rotated in this implementation.
1. Obtain explicit authorization, identify affected services and establish a rollback/contact window.
2. Inventory dependent server configurations by key name and owner, without exporting values.
3. Rotate through the trusted administration surface; place replacements directly into the approved local or hosted secret store. Never reuse an owner password for a restricted role.
4. Revoke superseded credentials and sessions as supported; verify old credentials no longer work using an approved sanitized check.
5. Independently verify each dedicated login with certificate-verifying TLS and only authorized data access.
6. Record operator, time, affected key names, verification outcome and approval reference without values. Until this evidence exists, rotation remains UNVERIFIED.

The operations PostgreSQL adapter requires its own separately approved restricted operations credential. Its offline migration is never applied automatically.

## Incident workflow
classifySecurityEvent emits bounded categories and actions. Authentication failures prompt session/activation/verifier checks; authorization failures prompt current role, permission, tenant and relationship checks; signature/replay failures prompt quarantine and provenance review; availability failures prompt sanitized health/recovery checks.

For an actual incident: preserve append-only audit evidence; contain the affected approved connector or account; revoke its sessions and bindings through authorized administration; preserve backups and correlation IDs; identify scope without copying request bodies; recover using the trusted backup manifest and isolated restore procedure; verify health, tenant isolation and audit continuity; record the decision owner and remaining risks. External communications and provider actions require explicit authorization.

## Governance controls
Retention policies are proposals requiring a different active carrier governor. Preview does not delete or deactivate records, establish a legal retention period, or bypass legal hold. Consent recording is blocked with the default empty approval registry; only server-owned separately approved version/text hashes can authorize it. A user's own account profile export excludes credentials. Audit exports contain tenant-scoped metadata and a content hash, omit detailed payloads, and remain immutable and permission-checked on replay.

## Release evidence
npm run ops:hosted:plan writes seven non-executed scenario contracts with explicit assertions for identity, registration, persistence, isolation, workflow, integrations and rollback. There is no hosted transport installed in that command. A receipt validator checks completeness; it does not independently attest that its input occurred. Actual hosted execution remains BLOCKED.

After npm run ops:certify, run npm run ops:release:check and npm run ops:release:validate. Ten independent gates retain manual accessibility, live model, credential, consent, PostgreSQL and deployment blockers even when all local tests pass. Local hashes detect stale or changed artifacts; externally signed attestation is not claimed.
