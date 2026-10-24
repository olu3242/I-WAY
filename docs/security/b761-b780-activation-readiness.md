# I-WAY B761–B780 — Controlled hosted activation readiness

**Local covered workflows: GO. Protected Preview activation: NO-GO. External UAT: NO-GO. Production: NO-GO.**

Branch: `work/b561-b580-external-uat`; worktree: `C:/Cdev/I-WAY/pkg/.worktrees/b561-b580-external-uat`.
Starting SHA: `22d8c90c6cbd7aecf1e740216dcbeeac87fefbc2`; starting worktree clean.
Ending SHA is the commit containing this report/receipt; its literal SHA, source/evidence bindings, reproducible artifact checksum and final clean status are in `dist/b761-b780/post-commit-verification.json`. This avoids a circular receipt self-hash.

This cycle changes only the three requested internal certification documents. Application, UI, SQL, dependencies, Git hooks and hosted configuration are unchanged. No push, merge, deployment, hosted SQL mutation, credential rotation, real-user provisioning, invitation, billing change, access grant or protection bypass occurred.

## B761–B770 — Infrastructure preparation

| Task | Evidence-backed result |
| --- | --- |
| B761 baseline | PASS: prior receipt hash binds the prior ending SHA; 17 source/schema hashes, 32 evidence hashes, 81 package blobs and 86 artifact files verified. Prior package reproduces byte-identically with SHA-256 4eb1d7b7aebd48de72949af026af8e3d29c967d253583a672112d74af9c28488. |
| B762 Git history | PASS read-only reconciliation: remote feature d02189b622fa29961a5d8ab743a68c1178ca1784 is an ancestor of starting HEAD; local starts two commits ahead, zero behind. Remote main 4f5a3a6bd82aa3d220ded562fd3f777ddb738b51 is an ancestor, 359 commits behind starting HEAD. No fetch/push/ref update. Ending candidate adds this one local commit. |
| B763 triggers | PASS inspection: public project Git enabled; staging Git creation/dispatch disabled; both use main as production branch, no root override/ignored-build command/deploy hooks. Staging SSO remains all. |
| B764 isolation | PASS prepared: preserve existing false branch rule and isolated artifact Git-disabled configuration; A01/A02/A10 include exact scope and rollback. Historical staging flag at the d021 push remains unverified. |
| B765 Preview names | PASS names/scope audit; BLOCKED configuration: all 13 required staging Preview names absent. Ten legacy staging names are Production-only. Public project names were separately inventoried without reading values. |
| B766 owner checklist | PASS prepared: thirteen rows below and machine-readable environment-contract.json; private validation and actual logins remain BLOCKED. |
| B767 auth schema | PASS limited catalog comparison: all 33 required column names/types match; five auth tables have RLS/FORCE, five auth policies and nine table grants observed. This is not complete runtime certification; actual hosted restricted login is BLOCKED. |
| B768 migration packages | PASS prepared and locally rehearsed; hosted execution BLOCKED: broker B631, ordered Operations migrations/B662, separate optional management B710 and read-only existing-auth review, each with hashes. |
| B769 roles/grants/RLS | PASS read-only requirements review; hosted logins BLOCKED: auth restricted flags observed and narrow B533 creator edge matches. Broker/Operations/management roles and schemas are missing. |
| B770 credentials | PASS procedures prepared; provisioning/rotation/login execution BLOCKED pending owner approval and fresh private credentials. No administrator impersonates a runtime identity. |

## B771–B780 — Identity and UAT preparation

| Task | Evidence-backed result |
| --- | --- |
| B771 Google/callback | PASS requirements prepared and public signing-key observation only: HTTP200, one ES256 public key; issuer/audience pinned by code. Genuine Google/password login and private provider settings remain BLOCKED. |
| B772 identities | PASS manifests prepared: existing synthetic fixture IDs labelled fixture-only; actual four-user canonical UUID/subject/principal bindings remain null. No email-only linking. |
| B773 MFA | PASS procedure prepared and synthetic requirements tested; actual enrollment/AAL2 certification BLOCKED. Privileged platform/carrier need pre-enrolled verified TOTP. Current application has no enrollment surface. |
| B774 issuer mocks | PASS: 29 focused management/provider/preflight tests, also included in full repository run. Generation, confidential delivery, deny defaults, canonical mapping, concurrency/revocation and audit tested without live delivery. |
| B775 hierarchy | PASS proposal prepared: platform control plane only; carrier tenant; child fleet; driver active employment under that fleet. Actual IDs, privileges and memberships remain unprovisioned. |
| B776 protected access | PASS supported mechanism documented; actual grants BLOCKED. Current Hobby plan allows one external collaborator at a time; serial grant/revoke plan preserves SSO and avoids team membership. |
| B777 hosted matrix | 84 BLOCKED, zero executed; each case has approval IDs, actual missing prerequisites and role-specific binding requirements. No synthetic result promotes a hosted case. |
| B778 accessibility | 48 scripts prepared, NOT RUN; hosted execution gates BLOCKED. Scripts cover AT versions, keyboard/focus, native dialogs, form/error recovery, zoom/spacing, mobile AT, session transitions and persona workflow. |
| B779 regression/security | PASS: 869 repository tests; 60 general browser cases; 79 PostgreSQL17 leaf scenarios; 16 durable browser variants; bounded credential scan and local package checks. |
| B780 consolidation | Three internal documents plus hashed local evidence, 12 pending approval actions and one local commit. Post-commit sidecar records literal ending SHA, integrity/reproducibility and clean worktree. |

## Owner-facing Preview configuration checklist

Exact project: `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, team `team_zNHlJbJHa4YZFwN4p9lcHzEH`, target **Preview only**. No public-project or Production configuration change is authorized. Values are intentionally absent below.

| Variable name | Recommended Vercel type | Purpose | Validation rule | Current Preview |
| --- | --- | --- | --- | --- |
| `IWAY_AUTH_ENABLED` | Config | Authentication activation | Exact true; owner approval required | Missing |
| `IWAY_AUTH_SCHEMA_APPROVED` | Config | Reviewed auth schema | Exact b512-v4 | Missing |
| `IWAY_STAGING_VERCEL_PROJECT_ID` | Config | Isolated project pin | Exact staging project; match genuine VERCEL_PROJECT_ID | Missing |
| `IWAY_AUTH_ORIGIN` | Config | Application callback and cookie origin | Exact HTTPS origin; no credentials, path, query or fragment | Missing |
| `IWAY_AUTH_APPROVED_ORIGIN` | Config | Owner-approved callback origin | Exact match to IWAY_AUTH_ORIGIN | Missing |
| `IWAY_AUTH_DATABASE_URL` | Secret | Auth persistence | Pinned PostgreSQL project/database; iway_auth_runtime LOGIN; verified TLS; session port 5432 | Missing |
| `IWAY_AUTH_PROVIDER` | Config | OAuth provider | Exact google | Missing |
| `IWAY_SUPABASE_PUBLISHABLE_KEY` | Config | Public Auth API credential | Publishable key or pinned-project anon compatibility key; never service-role/secret key | Missing |
| `IWAY_SESSION_ENCRYPTION_KEY` | Secret | Server-side token encryption | Canonical 43-character base64url 32-byte key; server only | Missing |
| `IWAY_UAT_ENABLED` | Config | UAT broker activation | Exact true; owner approval required | Missing |
| `IWAY_UAT_SCHEMA_APPROVED` | Config | Reviewed broker schema | Exact b574-candidate-v1 | Missing |
| `IWAY_UAT_DATABASE_URL` | Secret | Broker persistence | Pinned PostgreSQL project/database; iway_uat_runtime LOGIN; verified TLS; session port 5432 | Missing |
| `IWAY_OPERATIONS_DATABASE_URL` | Secret | Operations persistence | Pinned PostgreSQL project/database; iway_operations_runtime LOGIN; verified TLS; explicit port 5432; password at least 12 characters | Missing |

Owner sequence: privately verify staging data isolation and fresh restricted credentials; approve exact application origin; set non-activation Preview configuration through controlled channels; validate names/scopes and private value compatibility; enable activation flags only under the final exact-candidate deployment approval once all prerequisites pass. An inactive staging configuration is expected to fail the active runtime contract. Never manually override genuine platform VERCEL_ENV/VERCEL_PROJECT_ID to make Production pass. No env pull/upload/copy of .env.local occurred. Legacy PGSSL/DATABASE_URL and service-role values do not replace the three restricted runtime URLs.

The public project separately has Preview-scoped DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD names. Their values were not read, and name presence does not establish browser leakage. Optional A12 requires dependency verification and explicit Preview-only approval before removing any unused entry; Production is excluded.

## Schema and migration approval packages

Read-only hosted observation is PostgreSQL17.11, with only iway_private among required schemas. The five auth tables match required column names/types and FORCE RLS flags. A separate legacy early_access_leads table shares iway_private and is not part of the five-table auth contract; do not change it as part of this work. Policies/grants/constraints are saved as catalog metadata. Actual restricted runtime TLS logins, all readiness assertions under that identity, and hosted tenant-isolation execution remain BLOCKED.

The observed auth inbound edge grants iway_auth_runtime to postgres, with bootstrap grantor OID10, admin_option=true, inherit_option=false and set_option=false; postgres has CREATEROLE. This matches the committed B533/runtime exception and does not grant outbound runtime administrator access. Do not treat it as an unreviewed generic exception, revoke it automatically, or apply the older B513 first-create file to the already existing role. [PostgreSQL role membership](https://www.postgresql.org/docs/17/role-membership.html) distinguishes ADMIN/INHERIT/SET; [Supabase role guidance](https://supabase.com/docs/guides/database/postgres/roles) does not make the managed administrator an application runtime identity.

Broker B631 and Operations engine readiness have stricter membership requirements. A non-superuser managed creator may receive an inbound ADMIN edge. Credential owners must prove their provisioning method satisfies the exact installer/runtime checks; unresolved capability remains BLOCKED. No privilege exception was added. Each runtime needs LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION, no DDL/ownership/unrelated access and verified TLS. Broker receives six-table control-metadata grants only. Operations receives SELECT on five engine tables, UPDATE(payload,version) on state, INSERT on audit; the application cannot seed principals or deployment configuration.

| Package/order | Exact file | SHA-256 of canonical LF source |
| --- | --- | --- |
| auth-existing 1 | `db/review-only/iway_auth_runtime_review_b533.sql` | `4e7d38c287497db85b26a41dc9d90e28b027da7452867bb4b76034313217d312` |
| auth-existing 2 | `db/review-only/iway_auth_postflight_b512.sql` | `586c58958fcbd0e64d8fd16f524c4b10d88297a066911c5e189d4c368b7b4b6c` |
| broker 1 | `db/review-only/b631-broker-remediation.sql` | `47b9008a2bccf224976a2710c69703d0aa05c23433cb3ca92edd06dab37ad2a8` |
| broker 2 | `db/review-only/b631-broker-verify.sql` | `4f4c6e88891ed671a6de1499179685e0486836cb95f116f50e2a2567fb1bbb77` |
| operations 1 | `supabase/migrations/20261011174100_operations_persistence_readiness.sql` | `0f2bf75c58ab0af6cc7a245f092e29da2943a8316611e8aa85deb699d3436c81` |
| operations 2 | `supabase/migrations/20261011210552_operations_active_principal_rls.sql` | `0e18a93c613a977010bfaa481318033087a9687b2c086f7d5fe66746f9dc2ef9` |
| operations 3 | `supabase/migrations/20261011220000_operations_actor_evidence.sql` | `96969f98e7af15b7ba26527ab92764642e7eb8ebe2711921fe321a4b2ca8527e` |
| operations 4 | `supabase/migrations/20261011221000_operations_dispatcher_directory.sql` | `0a8b2ba5dddc1c8dd438797c3ef57e16a1eedce5515f8241e0ec01bc4236de5b` |
| operations 5 | `db/review-only/b662-operations-engine.sql` | `3e8f8f9d502a3aa39a826702ca56aae0815b46e85f5c7353a00c9dd0c9001e20` |
| management 1 | `db/review-only/b710-uat-management.sql` | `3d348be3fe7d4d13b284cac8dfe7031199ab635c8356b9846eb7de265c8ec05d` |

A04 uses B631 as first-install-or-verify, not an additional application of the older B574 CREATE SCHEMA script. A05 applies four checksum-guarded Operations migrations in the displayed order, then B662. A09 is a separate management process/schema with separately approved actor/transport/provider credentials; it is not a fourteenth application Preview key or a service-role addition to the application. SQL under db/review-only remains review-only, not an automatically applied linked migration. No hosted migration history was altered.

The fresh local PostgreSQL17.11 rehearsal exercised those contracts with synthetic data and genuine disposable restricted logins, including 16 FORCE RLS application tables, tenant/actor/schema denial, idempotency, encrypted proofs, real database restart and transaction rollback. It does not reproduce managed Supabase extensions, the complete hosted schema or a running GoTrue service. B446 is a disposable historical-upgrade input, not a hosted provisioning instruction.

## Credential provisioning and genuine-login verification procedure

1. Owner confirms the exact Supabase project/database is approved staging and that these changes cannot modify production or a shared production workload. If that attestation fails, stop; the code's pinned project must not be silently redirected.
2. After A03, owner provisions only missing role names and fresh private credentials using an authorized administrative channel. No password appears in SQL files, shell arguments, logs, screenshots, report or Git. Existing auth role review is read-only. Do not use postgres/service-role credentials as the application runtime or SET ROLE to impersonate it.
3. Store owner-managed libpq service/password profiles outside the repository with private ACLs and sslmode=verify-full, trusted CA, expected endpoint, postgres database and session port5432. Pooled username suffix differs from actual session_user; expect the base restricted role after login. Candidate database URLs have no query/fragment; Node TLS validation is configured by code. Do not downgrade certificate verification.
4. Connect separately as each actual restricted LOGIN. Using an owner-created private service profile, a read-only auth example is `psql service=iway_staging_auth -X -w -v ON_ERROR_STOP=1 -f db/review-only/iway_auth_postflight_b512.sql`. Service profiles are not supplied or created by this package. Reject password/authentication failures; never fall back to an administrator.
5. Verify SELECT session_user,current_user,current_database() plus pg_stat_ssl for the current backend, role flags/memberships, absence of schema CREATE/ownership and exact grants/policies. Auth additionally requires assertAuthDatabaseReady/B533 under that identity; broker requires assertUatPostgresRuntime and B631 verification; Operations requires the genuine durable engine health/identity contract and negative tenant/principal tests. Client-side verify-full success and server TLS observation must both hold. Print only sanitized statuses/metadata.
6. Record exact schema/source hashes, endpoint/role names and PASS/FAIL/BLOCKED per check. Use approved synthetic tenant IDs only after A08; confirm absent/forged/cross-tenant context denies. Session maintenance and active runtime checks may write auth/broker metadata, so run only after their activation approval. On failure keep activation disabled and preserve audit. No such hosted login was executed here.

## OAuth, canonical identity and MFA procedure

Google's registered provider callback must be `https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback`. Supabase's application redirect must be the exact owner-approved HTTPS Preview origin plus `/auth/callback`; no wildcard, credentials, path injection or Production origin substitution. Actual Google Console client identity and private provider/signup/linking settings are unverified. A07 does not authorize changes to an unidentified Google client; an exact-client addendum is required. See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

Public JWKS lookup returned200 with one ES256 key and passed the candidate loader. Expected issuer is `https://vnoxdinldneeczxibicp.supabase.co/auth/v1`, audience `authenticated`. No token or real login was used. Test genuine callback state/PKCE tampering, expiry, replay and wrong issuer/audience after approval; an accessible JWKS endpoint does not certify OAuth.

For each approved email, owner records canonical auth.users.id, exact Google provider subject, identity.user_id, native principal and role/tenant/fleet bindings. Supabase identity.id/identity_data.sub represent the Google subject; identity.identity_id is a distinct UUID. Email confirmation/allowlist alone must not create/link an account. Both Google and password must resolve to the same approved canonical identity. The identity manifest includes existing fixture IDs solely to reproduce local mocks; none is a proposed real account ID.

Owner-approved MFA sequence: provision/verify the canonical identity first; select a controlled authenticated enrollment route or utility; the tester privately enrolls a TOTP authenticator, verifies a challenge and obtains a verified factor. Current application requires pre-enrolled factors and offers no enrollment surface, so the route/tool is an unresolved prerequisite. Never record QR codes, seeds, OTPs or recovery secrets. On the actual application, platform/carrier AAL1 must remain denied until the verified factor yields a cryptographically verified AAL2 session; missing factor, wrong code, stale session and recovery/revocation tests must deny appropriately. Recheck current memberships after refresh/recovery. Do not enroll factors automatically or accept user_metadata as authority. See [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).

## Four-persona assignment preparation

| Approved email | Persona | Required assignment still pending |
| --- | --- | --- |
| oadeyemo306@gmail.com | Platform Administrator | Governance namespace/native principal; no carrier/fleet assignment; approved permissions; verified TOTP |
| martin@tm88investments.com | Carrier Administrator | Synthetic carrier tenant/native principal; approved permissions; verified TOTP |
| info@tm88investments.com | Fleet Administrator | Fleet/native principal under carrier tester tenant; approved employment authority/permissions |
| cassiomey@gmail.com | Driver | Active employment/native driver principal in fleet tester fleet under same carrier; approved operational permissions |

Observed Auth users, Google identities, active memberships and verified MFA: **zero each**. Actual IDs stay null and permission approvals remain false. Existing allowlist approval does not authorize accounts, administrators, memberships or invitations. The authoritative existing roster file is preserved unchanged. Proposed relationships and existing synthetic fixture mappings are in identity-mapping-manifest.json; no real UUID/fleet/employment record was invented.

Management issuance remains fail closed in the hosted application. A09 requires a separate process, restricted metadata role, approved AAL2 administrator, roster digest, exact origin, bounded owner approval, existing-user recovery-link issuer and identified confidential transport. Mocks verify denial before provider calls, canonical identity, one-time redemption, idempotency, concurrency, recovery/revocation and append-only audit. Ambiguous delivery remains quarantined; no automatic resend. The four approved recipients received no messages.

## Protected access and hosted execution

Current eduradiusllc plan is Hobby. Use individually invited external collaborators on the exact commit-specific protected Preview, one at a time with verified revocation before the next; no team membership, shared bypass link or SSO removal. Testers need their own Vercel accounts for the protection layer, then separate I-WAY identity/authorization. [Vercel sharing](https://vercel.com/docs/deployments/sharing-deployments) documents the Hobby limit. Four simultaneous external collaborators need a separately approved plan/billing change; [Pro pricing](https://vercel.com/docs/plans/pro-plan) starts at USD20/month plus applicable usage/tax. No billing change was made or included in the serial plan.

The 84-case matrix names prerequisites, exact routes/controls, expected outcomes, role-specific bindings and required approvals; all cases are BLOCKED with zero execution. Complete actual Google/password login, session refresh/logout/replay, unauthorized fifth user, wrong tenant/fleet/employment, invitation expiry/recovery/revocation and permitted MVP outcomes only after gates pass. Preserve sanitized evidence against the exact deployed SHA.

All 48 manual accessibility scripts remain NOT RUN, with hosted execution gates BLOCKED. JSON and readable Markdown scripts provide step-by-step keyboard/AT/mobile/native-dialog tasks, pass/fail criteria, environment/reviewer fields and evidence-redaction rules. Passing automated axe does not establish complete WCAG conformance. Fault-injection cases require isolated approved faults; do not disrupt hosted services to manufacture a failure.

## Exact local results and scope

| Check | PASS | FAIL | Skipped | Counting rule |
| --- | ---: | ---: | ---: | --- |
| npm run verify | 869 | 0 | 0 | Fresh full run; build/source/IP/site gates also pass. |
| General Playwright | 60 | 0 | 0 | One complete run. |
| PostgreSQL17.11 | 79 leaf scenarios | 0 | 0 | 86 reported Node checks minus7 orchestration parents. |
| Durable PostgreSQL17 browser | 16 | 0 | 0 | Repeats16 general lifecycle case identities; not added to the60 unique browser cases. |
| Focused management/provider/preflight | 29 | 0 | 0 | Already included in869; not added again. |
| Hosted E2E | 0 | 0 | 0 | 84 BLOCKED, zero executed. |
| Human accessibility | 0 | 0 | 0 | 48 NOT RUN; hosted gate BLOCKED. |

Axe:121 general scans and16 durable-mode scans, zero violations in each. Control outcomes:40/40 actions,25/25 forms,30/30 button labels,18/18 navigation entries. Inventory retains48 source route patterns,76 fields (55 interacted),12 native dialogs; this is not universal field-permutation/dynamic-route or human AT coverage. No unique grand total is claimed across layers or repeated variants. No unresolved automated failure was observed in this cycle.

Secret scanning checks configured private values/decoded database password and selected private-key formats without serializing values; .env.local stays ignored/untracked. No .env.local content was printed, copied into delivery, committed or uploaded. The scan is bounded, not a universal secret guarantee. All internal approval/report/fixture material is excluded from the isolated delivery package.

## Unresolved dependencies and release decisions

The local candidate and approval package are **GO for owner review**. Protected Preview activation, external UAT and production remain **NO-GO**. Missing dependencies:13 Preview keys; fresh restricted credentials and actual logins; broker/Operations/management schemas/roles; owner-confirmed staging-only data scope; exact Preview origin/private provider settings/Google client identification; real canonical identities/hierarchy/permission bindings; approved privileged MFA enrollment route; management process/transport identity; individual external access; actual hosted E2E and human accessibility evidence.

All12 actions in b761-b780-approval-matrix.md identify target, intended change, dependencies/prerequisites, risk, verification, rollback and responsible owner. Every decision is pending; none was requested interactively or executed. Optional Git publication and public Preview secret hygiene are separate from activation. No main merge, Production activation, protection bypass or billing change is authorized by this report.
