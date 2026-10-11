# I-way hosted registration: operator runbook

Target Supabase project: `vnoxdinldneeczxibicp`. All connection material belongs in server or CI secrets, never public assets, source control, command arguments, screenshots, or logs.

## Database identity

The application authenticates as `iway_registration_login`, which inherits the existing `iway_registration` INSERT-only role. It does not authenticate as `postgres`, a table owner, a migration administrator, or a Supabase service-role identity. A service-role API key is not a PostgreSQL login credential.

Apply `supabase/migrations/20261011062148_registration_login.sql` with an authorized migration identity after checking the project and migration history. It requires PostgreSQL 16+, the existing private table with RLS enabled, and the already deployed registration role and INSERT policy. It neither recreates the table/policy nor adds table privileges. Do not apply the legacy `migrations/001_early_access.sql` to this hosted schema.

The migration fails transactionally if its prerequisites are missing or the login name already exists. Investigate rather than weakening the checks. It creates a login without a password and grants only `iway_registration` membership, with `INHERIT TRUE, SET FALSE, ADMIN FALSE`. Neither role may be privileged or own the table; the registration role must not inherit other roles. Do not grant access to `anon`, `authenticated`, or `PUBLIC`; do not disable RLS.

Provision a strong unique password separately through a secure administrative channel, for example interactive psql `\password iway_registration_login` over verified TLS. Store the resulting connection credential directly in the deployment secret manager. Do not put the password in a migration, shell history, SQL Editor history, issue, or this document. Rotate it independently of owner credentials. Revoking login or membership is the rollback for application access; never roll back by deleting registration data.

## Server connection

Use a direct database connection, or the project's supported session pooler with the custom login. The direct username is `iway_registration_login`; Supavisor uses the custom login followed by a dot and the project reference. Confirm the endpoint and port in the target project's Connect panel. Keep the application's identity the same through the pooler; do not connect as an administrator then use SET ROLE. Inherited privileges avoid session-dependent role switching.

Inject `DATABASE_URL`, `PGSSL=require`, `NODE_ENV=production`, and the actual approved `IWAY_CONSENT_VERSION` into the Node server environment. Use a trusted certificate chain (`NODE_EXTRA_CA_CERTS` if the provider requires its CA). Keep SSL options out of the URL query: node-postgres URL options can replace the explicit SSL configuration. Never disable certificate validation. Only `site/public` may be served as static assets; the database URL and test credentials must never enter browser configuration.

Startup uses `SELECT 1` to check connectivity. This does not prove INSERT permissions, policy validity, or hosted readiness. Registration uses parameterized SQL, normalized email SHA-256, strict consent validation, and `rowCount`. No row contents or identifier are returned from PostgreSQL. Untargeted `ON CONFLICT DO NOTHING` avoids the SELECT privilege required by an explicit conflict target; do not restore `RETURNING` or grant SELECT to make the adapter work. With the current schema, conflicts are on the email hash or generated UUID primary key. Any future unique constraint needs a duplicate-semantics review.

## Opt-in PostgreSQL certification

`npm run verify` runs local unit/HTTP tests (including mocked PostgreSQL) and public-site checks. It does **not** run hosted tests or certify a deployment.

For the real PostgreSQL suite, inject these environment variables through an authorized secret manager:

- `IWAY_PG_TEST_OPT_IN=1`: authorizes synthetic registration writes.
- `IWAY_PG_TEST_URL`: dedicated registration-login credential; never an owner URL. No query options or fragment.
- `IWAY_PG_TEST_HOST`: expected database/pooler hostname, independently checked against the URL.
- `IWAY_PG_TEST_CONSENT_VERSION`: approved notice version for the target test environment.

Run `npm run test:hosted`. Missing opt-in, credentials, host, or consent version causes a nonzero exit and **NOT RUN / NO-GO**, never a skipped PASS. Hosted mode rejects loopback targets and requires certificate-verified TLS. Use the approved certification database; the suite writes three clearly illustrative records with unique `example.invalid` emails. It does not hard-delete records or gain cleanup privileges. Handle them through the approved retention process.

The suite checks actual session identity, membership restrictions, effective privileges and RLS; launches `server/start.mjs`; checks HTTP 201 insertion, normalized duplicate 200, invalid-consent 400 and database constraint/policy rejection; requires SQLSTATE 42501 for SELECT/UPDATE/DELETE; then terminates and restarts the application process and requires the original registration to remain a duplicate. Denial probes cannot modify real rows even if permissions regress. No owner/read-back credential is used: the existing unique key proves persistence through a fresh process. This certifies application restart, not database-server restart or disaster recovery.

`npm run test:pg:local` runs the same suite against a loopback PostgreSQL fixture with the pre-existing role/policy and new login migration applied. It explicitly reports **LOCAL**, cannot produce hosted evidence, and does not require TLS. Keep local fixture administration separate from the restricted test connection.

A successful hosted run certifies the local Node process against the specified hosted database. It does not certify a deployed browser-to-runtime route. Before public release, also verify the deployed browser flow, runtime secret injection/TLS, distributed rate limits, approved consent/privacy notice, retention, and abuse controls. Do not substitute mocked tests or a successful health response for those checks.

## Evidence — 2026-10-11

- Local repository verification: 18 tests passed, no skips; IP scan and four-page site structure check passed.
- Isolated local PostgreSQL 18.3: migration applied successfully to a fixture of the existing role/policy. All nine database/HTTP checks passed (10 Node test results including the parent), no skips. This includes actual process restart and denied SELECT/UPDATE/DELETE.
- Hosted certification: **NOT RUN / NO-GO**. Required runtime credentials are absent. The connected Supabase account does not list the target project. No hosted schema changes were applied.
- Security review: no additional table grants, no RLS changes, no public-role grants, no secrets in source or browser assets, and no application owner/service-role identity. New identity creation and hosted provider behavior still require target-environment verification.

References: [PostgreSQL INSERT privileges](https://www.postgresql.org/docs/current/sql-insert.html), [role membership](https://www.postgresql.org/docs/current/role-membership.html), [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [node-postgres TLS](https://node-postgres.com/features/ssl).
