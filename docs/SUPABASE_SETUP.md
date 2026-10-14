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

Run `npm run test:hosted`. Missing opt-in, credentials, host, or consent version causes a nonzero exit and **NOT RUN / NO-GO**, never a skipped PASS. Hosted mode rejects loopback targets and requires certificate-verified TLS. Use the approved certification database; the suite writes four clearly illustrative records with unique `example.invalid` emails. It does not hard-delete records or gain cleanup privileges. Handle them through the approved retention process.

The suite checks actual session identity, membership restrictions, effective privileges and RLS; launches `server/start.mjs`; checks HTTP 201 insertion, normalized duplicate 200, invalid-consent 400 and database constraint/policy rejection; requires SQLSTATE 42501 for SELECT/UPDATE/DELETE; then terminates and restarts the application process and requires the original registration to remain a duplicate. Denial probes cannot modify real rows even if permissions regress. No owner/read-back credential is used: the existing unique key proves persistence through a fresh process. This certifies application restart, not database-server restart or disaster recovery.

`npm run test:pg:local` runs the same suite against a loopback PostgreSQL fixture with the pre-existing role/policy and new login migration applied. It explicitly reports **LOCAL**, cannot produce hosted evidence, and does not require TLS. Keep local fixture administration separate from the restricted test connection.

A successful hosted run certifies the local Node process against the specified hosted database. It does not certify a deployed browser-to-runtime route. Before public release, also verify the deployed browser flow, runtime secret injection/TLS, distributed rate limits, approved consent/privacy notice, retention, and abuse controls. Do not substitute mocked tests or a successful health response for those checks.

## Evidence — 2026-10-11

- Local repository verification: 18 tests passed, no skips; IP scan and four-page site structure check passed.
- Isolated local PostgreSQL 18.3: migration applied successfully to a fixture of the existing role/policy. All nine database/HTTP checks passed (10 Node test results including the parent), no skips. This includes actual process restart and denied SELECT/UPDATE/DELETE.
- Hosted certification: **NOT RUN / NO-GO**. Required runtime credentials are absent. The connected Supabase account does not list the target project. No hosted schema changes were applied.
- Security review: no additional table grants, no RLS changes, no public-role grants, no secrets in source or browser assets, and no application owner/service-role identity. New identity creation and hosted provider behavior still require target-environment verification.

References: [PostgreSQL INSERT privileges](https://www.postgresql.org/docs/current/sql-insert.html), [role membership](https://www.postgresql.org/docs/current/role-membership.html), [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [node-postgres TLS](https://node-postgres.com/features/ssl).

## Initial environment audit — 2026-10-11 (before reconciliation)

Startup and the certification command load the project-root `.env.local` before reading configuration, independently of the launch working directory. Node >=20.12.0 is required for its native dotenv parser. Existing process environment values take precedence, including empty values. Within a file, the last duplicate definition wins; keep each variable name exactly once. Values are not interpolated from other variables. Only the documented application and certification names are loaded. Node bootstrap settings such as `NODE_EXTRA_CA_CERTS` must be supplied by the launcher before Node starts.

A configured but empty `DATABASE_URL` fails closed; omit it entirely only when deliberately using local file preview. Remote PostgreSQL connections require certificate verification and the dedicated login name. URL query options, owner identities, missing consent versions and invalid TLS settings fail before connecting. Valid credentials still require the real role/ACL/RLS certification checks; a matching username alone is not proof of authorization. Startup errors never include raw driver messages or connection material.

The `.env.local` audit in `C:\Cdev\I-WAY-app` found:

| Variable | Status |
| --- | --- |
| PORT | PRESENT |
| DATABASE_URL | INVALID |
| PGSSL | INVALID |
| IWAY_CONSENT_VERSION | EMPTY |
| NODE_ENV | MISSING |
| IWAY_PG_TEST_OPT_IN | MISSING |
| IWAY_PG_TEST_URL | MISSING |
| IWAY_PG_TEST_HOST | MISSING |
| IWAY_PG_TEST_CONSENT_VERSION | MISSING |
| NEXT_PUBLIC_SUPABASE_URL | PRESENT |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | PRESENT |
| SUPABASE_SERVICE_ROLE_KEY | PRESENT |
| SUPABASE_DB_PASSWORD | PRESENT |
| SUPABASE_PROJECT_REF | PRESENT |

`PORT`, `DATABASE_URL`, `PGSSL`, and `IWAY_CONSENT_VERSION` have duplicate definitions. The final consent entry is empty. The effective database URL does not provide a valid dedicated-login connection; its parsed login/password fields cannot satisfy the application configuration. No connection was attempted with these settings. PRESENT means configured, not authenticated or legally approved.

The five Supabase-prefixed variables in the table (including NEXT_PUBLIC names) are unused by this static-site/Node PostgreSQL application. `SUPABASE_DB_PASSWORD` is not a substitute for `DATABASE_URL`, and the service-role key is not a PostgreSQL credential. Do not copy them to browser assets or use them as fallback credentials. Existing secrets were left intact.

Remediation:

1. Reconcile duplicate entries locally, preserving valid secrets. Provision the dedicated login credential into `DATABASE_URL` through the approved secret channel; do not substitute an owner account. Supply the documented certificate-verifying `PGSSL` configuration and deployment `NODE_ENV`.
2. Supply the actual approved `IWAY_CONSENT_VERSION`; the code cannot establish legal approval from a string.
3. Verify the target project and the existing registration role, then apply/confirm the login migration with an authorized migration administrator. The migration is present locally; its remote application and login readiness remain unverified because target-project access is unavailable.
4. Provision all four certification variables separately. Enable certification opt-in only after identity and authorization review. Do not treat absent credentials as skipped success.

`.env.local` is ignored by `.env.*` and is not tracked. No secrets were changed or committed. No hosted SQL or registration writes were performed. `npm run verify` passed all 28 tests with zero skips, plus IP and site checks. Hosted certification remains **NO-GO** pending the above provisioning and remote verification; these regression tests do not certify a hosted connection.

Parser reference: [Node.js parseEnv](https://nodejs.org/api/util.html#utilparseenvcontent). TLS reference: [node-postgres SSL configuration](https://node-postgres.com/features/ssl).

## Batch reconciliation — 2026-10-11

All prior local changes were preserved, including the original 28 passing regression tests. Two additional guard tests pin hosted certification to the authorized Supabase project and reject placeholder consent approval. The certification runner resolves its test working directory from the repository.

The ignored local environment file now has one active definition per duplicate name. Identical duplicate entries were removed. TLS configuration was corrected and the missing production-mode setting was added. Existing credentials were preserved. `DATABASE_URL` currently contains a noncredential public project locator, not a PostgreSQL connection, and was not converted using owner credentials. The earlier populated consent candidate is retained only as an inactive comment; the effective consent version remains empty until approval is supplied. No credential was inferred from an owner password or API key.

Current configuration:

| Variable | Status |
| --- | --- |
| PORT | PRESENT |
| DATABASE_URL | INVALID |
| PGSSL | PRESENT |
| NODE_ENV | PRESENT |
| IWAY_CONSENT_VERSION | EMPTY |
| IWAY_PG_TEST_OPT_IN | MISSING |
| IWAY_PG_TEST_URL | MISSING |
| IWAY_PG_TEST_HOST | MISSING |
| IWAY_PG_TEST_CONSENT_VERSION | MISSING |

Target checks used only explicit project reference `vnoxdinldneeczxibicp`. The local CLI link matches. CLI migration history reports `20261011055816` in both local and remote columns and `20261011062148` only in the local column. No migration was executed. The target was absent from the CLI project listing, and the catalog query exited nonzero without a verified role result. Migration-list metadata does not establish sufficient provisioning access; do not infer that the login is absent merely because its migration is pending.

The new `scripts/registration-preflight.sql` reads only catalog metadata: roles, memberships, RLS, privileges, PUBLIC grants and the existing INSERT policy. It does not read leads, credential hashes, or password fields. Its SQL was validated on the isolated local PostgreSQL fixture. The hosted certification suite now also requires INSERT/USAGE, denies schema CREATE and public-role access, checks PUBLIC schema/table/column grants, and verifies a 503 response from an unavailable real connection pool followed by successful retry. This controlled pool failure is not a provider-wide outage test.

Evidence:

- `npm run verify`: 30 tests passed, zero skips; IP and site checks passed.
- `npm run test:pg:local`: ten scenarios passed (11 Node results including the parent), zero skips, against real isolated PostgreSQL. The fixture was stopped afterward.
- `npm run test:hosted`: exit 1, NOT RUN because opt-in/credentials are unavailable. No hosted registration, provisioning, migration, or permission writes occurred.
- Local environment files remain ignored and untracked. The index secret scan passed across 47 tracked files using private local values and credential-signature checks. One match was confirmed to be the noncredential public project locator, not a secret. Git diff whitespace checks passed.

Human gate:

1. Authenticate the Supabase CLI with an account/token authorized for `vnoxdinldneeczxibicp`. Confirm the project is accessible and run the read-only preflight against that exact reference. If it fails, an authorized project administrator must inspect the failure privately.
2. Compare migration history and existing role state. If the login does not exist and migration prerequisites pass, an authorized administrator may apply the pending login migration once. If it already exists, review its memberships/attributes instead of rerunning CREATE ROLE or dropping it. Do not change table grants, policies or RLS to pass a test.
3. Provision the dedicated login password through the approved secret channel. Supply valid server-only `DATABASE_URL` and separate `IWAY_PG_TEST_URL` plus `IWAY_PG_TEST_HOST`. Never use an owner/service-role identity or send secrets in chat.
4. Obtain legal/product approval of the consent notice version and populate both consent-version variables. Only then enable certification opt-in for isolated illustrative test records and rerun hosted tests.

Final hosted decision: **NO-GO**. Local code/test readiness does not certify the hosted identity or deployment.

## TLS trust remediation and read-only probe (2026-10-11)

The application uses Node's bundled root store by default. The observed Supabase
Session Pooler chain ends at Supabase Root 2021 CA, which was absent from both
Node's bundled store and this machine's Windows store. No extra CA bundle,
OpenSSL trust override, or HTTP proxy environment variable was configured.
The error was `SELF_SIGNED_CERT_IN_CHAIN`, before authentication or SQL.

The public CA was fetched over verified HTTPS from the production download URL
specified by Supabase's official dashboard configuration:
- [Official dashboard configuration, pinned revision](https://github.com/supabase/supabase/blob/8617532ae1a41571d5d557cd24c6f5f2565d9230/apps/studio/hooks/custom-content/custom-content.json)
- [Official CA download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)
- [Supabase SSL requirements](https://supabase.com/docs/guides/platform/ssl-enforcement)

The downloaded root exactly matched the presented root. All chain signatures and
validity periods, SSL server purpose, and the actual hostname were verified.
This supports a missing provider CA diagnosis; there was no evidence of a
substituted TLS-inspection certificate on this connection.

| Certificate | Issuer | Validity (UTC) |
| --- | --- | --- |
| `*.pooler.supabase.com` | Supabase Intermediate 2021 CA | 2025-03-12 to 2030-03-11 |
| Supabase Intermediate 2021 CA | Supabase Root 2021 CA | 2023-10-24 to 2033-10-21 |
| Supabase Root 2021 CA | Self-issued authenticated root | 2021-04-28 to 2031-04-26 |

Root SHA-256 fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The public certificate is stored at `server/certs/supabase-prod-ca-2021.crt`.
`server/postgres-tls.mjs` checks its fingerprint, CA status, self-signature, and
validity before returning connection-scoped `ssl.ca` with
`rejectUnauthorized: true`. Node's default hostname verification is unchanged.
This applies only to the authorized direct Supabase hostname and Supabase pooler
hostnames. Other database hosts retain their existing trust configuration.
No system root store, TLS bypass flag, or environment credential was changed.
Never replace this root with a certificate merely copied from an untrusted peer.
For rotation, independently reauthenticate the provider's official source, verify
the new chain, and review the certificate and fingerprint changes together.

`postgresConfig` shares the existing database security validation between startup
and a new read-only probe. `serverConfig` still requires the approved consent
version before application startup. Certification's TLS configuration shares the
same CA helper; its existing explicit opt-in and consent gates remain intact.

Run `npm run probe:postgres` to load the exact project-root `.env.local` through
the existing allowlisted loader into an isolated environment. The probe requires
the approved Session Pooler hostname, port 5432, database `postgres`, and
`iway_registration_login.vnoxdinldneeczxibicp`. It executes only:

```sql
SELECT current_user, current_database(), 1;
```

It requires a certificate-verified TLS session and the effective identity
`iway_registration_login`, closes the connection, and emits only sanitized
results. A failure exits nonzero without retries. It does not start the HTTP
server, supply a consent version, query registration data, or enable certification.
Connection success alone does not satisfy the separate consent and hosted
registration release gates.

Verification results for this remediation:

- Live credential-free TLS verification against the configured Session Pooler:
  PASS, with the independently authenticated Supabase root and exact hostname.
- Deliberately incorrect hostname: rejected. No TLS verification bypass was used.
- Restricted read-only probe: CONNECTION BLOCKED, authentication SQLSTATE
  `28P01`. TLS trust no longer blocks the connection; password authentication
  failed before the requested query could execute. No effective identity or
  database query result was obtained. No retry or administrator fallback occurred.
- The next operator action is to confirm the existing dedicated login credential
  through its approved secure source and update it locally if necessary. Do not
  substitute the owner password. No password or permission was changed here.
- Consent remains a separate release gate; no consent value was supplied.
- No migrations, registration writes, hosted certification, or system trust-store
  changes were performed.
- Final `npm run verify`: PASS, 39 tests with zero failures or skips, plus IP and site checks. `git diff --check` passed.
