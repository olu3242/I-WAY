# I-WAY B631–B650 — Unified local preparation and hosted certification

## Executive status

Safe local preparation is complete; **hosted activation is NO-GO**. No push, deployment, merge, hosted migration, account, invitation, billing or protection change was performed. The public website and production configuration were preserved. This packet is internal review material and must never be deployed.

Branch: `work/b561-b580-external-uat`. Certified application baseline: `b744cdc80d2cd2b9d5d0629baa2e044244cbc084`. Subsequent preparation changes add review-only SQL, a disposable migration rehearsal, a privileged Google/MFA integration test and this handoff. There is no new deployed candidate. The receipt records the exact preparation file manifest and hashes; any later deployment approval must name the final implementation SHA and package hash after the remaining engineering work.

## Evidence and integrity

The dated B611–B620 inspection snapshot is reused with hash verification rather than represented as a new hosted inspection. Its environment observation time is `2026-10-23T22:58:39.886Z`. The packet includes sanitized Git settings, environment names and catalog results. Reinspect changeable settings immediately before any authorized activation. Prior full-suite evidence remains tied to its certified source, not a hypothetical hosted implementation.

The candidate started clean. Existing changes were preserved. Local configured-secret scanning compares tracked regular files and preparation artifacts with private configured secrets in memory; no secret values are included in reports. Gitlinks are explicitly excluded from recursive scanning. Secret scanning is bounded evidence, not proof that no unknown credential exists. Credentials exposed in the conversation require owner-managed rotation before hosted activation; this execution did not rotate credentials.

## Infrastructure and environment

| Gate | Evidence | Result |
| --- | --- | --- |
| Git trigger isolation | Both projects link to `olu3242/I-WAY`, production branch `main`; public `i-way` Git deployment creation enabled, staging disabled | **BLOCKED**: feature push can trigger a public-project Preview; no push performed |
| Delivery strategy | Exact-SHA allowlisted package sent directly to isolated staging after approval; never upload the repository root | Prepared; full application package not yet implemented |
| Deployment target | Last inspected staging deployment is Production-target, not genuine Preview | Incompatible with candidate Preview-only security gate; gate preserved |
| Auth role catalog | `iway_auth_runtime` is LOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION; no memberships/owned tables | Catalog PASS only; actual hosted runtime login **BLOCKED** |
| Business auth RLS | Five auth tables have RLS and FORCE RLS in the snapshot | Catalog PASS; hosted runtime enforcement not certified |
| Broker schema/role | `iway_uat_private` and `iway_uat_runtime` absent in snapshot | Hosted remediation **BLOCKED** pending separate owner approval and restricted credential provisioning |
| Preview configuration | All twelve required names missing; root local configuration missing ten | **BLOCKED**; exact names/scopes in `environment-matrix.json` |
| Hosted Operations persistence | Native application uses synchronous SQLite; PostgreSQL adapter is an async readiness contract | **BLOCKED ENGINEERING**: durable application integration remains unfinished |
| Hosted application package | Existing entrypoint/package handles auth only, omits integrated UAT/Operations routes | **BLOCKED ENGINEERING**: rewrites or environment flags cannot close this gap |

Required Preview names are `IWAY_AUTH_ENABLED`, `IWAY_AUTH_SCHEMA_APPROVED`, `IWAY_STAGING_VERCEL_PROJECT_ID`, `IWAY_AUTH_ORIGIN`, `IWAY_AUTH_APPROVED_ORIGIN`, `IWAY_AUTH_DATABASE_URL`, `IWAY_AUTH_PROVIDER`, `IWAY_SUPABASE_PUBLISHABLE_KEY`, `IWAY_SESSION_ENCRYPTION_KEY`, `IWAY_UAT_ENABLED`, `IWAY_UAT_SCHEMA_APPROVED`, and `IWAY_UAT_DATABASE_URL`. Platform-provided `VERCEL_ENV=preview` and the staging project ID must be genuine; do not spoof a Production deployment. Schema/activation flags may be enabled only after verification and approval. Registration credentials and service-role keys are never runtime substitutes.

The new review-only broker SQL installs once and verifies on repetition. It requires a separately provisioned restricted role and does not create credentials, Auth users or memberships. Partial or insecure existing schemas fail closed for separately reviewed repair. Broker policies intentionally cover global authentication control metadata; they are not tenant-resource RLS. Business tenant isolation is enforced separately through auth-resource RLS and application authorization. Read the SQL and deployment plan before considering hosted execution.

## Authentication and tester access

The snapshot reports Google and email providers enabled, signup open, zero Auth users, zero Google identities and zero active tenant memberships. Provider enablement does not prove correct callbacks, verified Google identity mapping, application authorization or a working hosted session lifecycle. Review the shared-project signup/identity-linking policy with the owner; no provider settings were changed.

Verify two separate redirects: Google to the pinned Supabase `/auth/v1/callback`, and Supabase to the approved exact Preview origin's `/auth/callback`. The application origin, Google-console configuration and Supabase redirect allowlist remain unverified. No origin or identity identifier has been invented.

| Approved email | Intended role | Required real evidence before activation |
| --- | --- | --- |
| oadeyemo306@gmail.com | Platform Administrator | Canonical Auth UUID, exact Google subject, native principal, approved governance namespace/permissions, MFA; no carrier/fleet assignment |
| martin@tm88investments.com | Carrier Administrator | Canonical identity/principal, actual carrier ID, permissions and MFA |
| info@tm88investments.com | Fleet Administrator | Canonical identity/principal, actual fleet and parent carrier IDs, permissions |
| cassiomey@gmail.com | Driver | Canonical identity/principal, carrier/fleet IDs, verified active employment relationship and permissions |

All real mapping fields remain unresolved in `provisioning-manifest.json`. Email roster approval is not provisioning or privilege approval. Do not auto-link accounts by email or infer authorization from successful Google authentication.

The new local integration test exercises privileged Google AAL1 for Platform and Carrier: no native or parent application session before MFA, cross-origin MFA denied, correct existing principal after step-up, and one-use challenge replay denied. This uses synthetic signed identities, not the real Google provider. Password setup, MFA, recovery, refresh, logout, revocation, CSRF and identity binding are covered by the targeted local suites; hosted behavior remains unverified.

Recommended protected human entry is four individually invited external Preview collaborators, retaining all-deployment SSO and application allowlisting/RBAC. They do not become Vercel team members; protected access requires their Vercel accounts. Hobby permits one collaborator at a time; Pro/Enterprise support multiple. An eligible plan and owner-approved costs are prerequisites, not changes performed here. [Vercel sharing documentation](https://vercel.com/docs/deployments/sharing-deployments) supports these restrictions. Published Pro pricing starts at $20/month plus applicable usage, seats and taxes; four external collaborators do not imply four developer team seats. [Vercel pricing](https://vercel.com/pricing). No shared bypass link or credential is proposed as the human access control.

## Verification and uncovered scenarios

| Evidence | PASS | FAIL | SKIP | Scope |
| --- | ---: | ---: | ---: | --- |
| Prior repository suite | 806 | 0 | 0 | Reused certified baseline evidence |
| Prior browser suite | 52 | 0 | 0 | Reused local synthetic browser evidence |
| Prior PostgreSQL checks | 41 | 0 | 0 | 18 auth + 7 broker + 16 Operations contracts; disposable local clusters |
| Prior axe scans | 105 | 0 violations | — | Automated scans; not complete WCAG conformance |
| Fresh targeted authentication | 37 | 0 | 0 | Includes new privileged Google AAL1/MFA integration |
| Fresh broker remediation rehearsal | 11 | 0 | 0 | Disposable PostgreSQL 18; one parent plus ten subtests; idempotency/security rejection and real restricted local identity |
| Fresh source/build/IP/site checks | 4 commands | 0 | — | Source syntax/boundary, build six pages, public IP scan and site contract |
| Hosted E2E | 0 | 0 | — | **84 BLOCKED**, zero executed |
| Human accessibility | 0 | 0 | — | **48 NOT RUN**, prepared checklist |

An initial sandbox launch of the targeted tests failed with `spawn EPERM` before tests could execute; rerunning outside that process restriction passed. It is an infrastructure attempt, not six application test failures. Full suites were not redundantly rerun. No new browser claim is made. Native dialogs, screen readers, physical mobile testing, real Google consent/MFA, delivery/SMTP, password activation/recovery links and hosted runtime/tenant behavior still require execution. New PostgreSQL rehearsal details and all file/evidence hashes are in the receipt.

Existing route/control evidence covers 40 actions, 25 forms, 30 button labels and 18 navigation entries with meaningful outcomes for implemented local workflows. It does not establish every possible field permutation, production AI integration, every HTTP method or hosted durability. Applicable agent workflows must use their implemented backend and approved synthetic UAT data; no hosted AI workflow is claimed here.

## Hosted execution and rollback

The included 84-case matrix retains Google/password × four personas, session lifecycle, MFA, authorization, tenant denial, identity mismatch, invitation expiry/replay, CSRF and failure/recovery cases. Prerequisites are ordered in `execution-plan.json`. Execute none using invented users, temporary permissive bindings or administrative runtime credentials. A fifth-user negative case requires an approved existing test identity or separately approved synthetic identity; it does not authorize creating a fifth real account.

Last inspected deployment: `dpl_APs1ZkJVQfADo9H8Vq6wxDFBfPNc`, READY, source `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`, target Production inside isolated staging, URL `https://iway-auth-staging-mo7yigsep-eduradiusllc.vercel.app`. This is snapshot evidence, not the current candidate or a verified safe rollback target. No new deployment ID/URL exists.

Before deployment approval, complete durable Operations integration, injected authorization/identity/delivery dependencies and an explicit package allowlist with tested routes. After approved configuration and exact-artifact delivery, verify actual Preview target, project, SHA, protection and sanitized health; test intended routes and denied private paths. An auth-only health response cannot certify the application. Do not expose cookies, OAuth codes, setup fragments, tokens or credentials in evidence.

Contain failure by keeping SSO enforced and withdrawing the failed Preview from tester use under approved incident authority; revoke affected sessions/shares only with authorization. Restore a staging alias only to an independently verified compatible deployment. If none exists, keep tester access unavailable. Never blindly promote the old Production-target auth deployment, weaken RLS, substitute privileged credentials or drop schemas/audit records. Production aliases and the public website remain outside this operation. The detailed procedure is in `b631-deployment-plan.md`.

## Minimum approvals and decisions

Engineering completion is required before deployment approval can result in a usable full application. Then obtain separately scoped approval for:

1. Restricted broker-role credential provisioning and reviewed schema application; secure Preview configuration and actual runtime-login verification.
2. Approved exact HTTPS origin, Google/Supabase callbacks, provider signup/linking policy and privileged MFA arrangements.
3. Actual synthetic carrier/fleet/governance relationships, four real identity/principal mappings and approved permissions; account creation and invitation delivery separately authorized.
4. Eligible-plan costs, if required, and four individually scoped Preview collaborator grants; retain existing SSO.
5. Exact final implementation SHA/package hash deployed directly to the isolated staging **Preview** project; no Git push, main merge or production release implied.

| Decision | Result |
| --- | --- |
| Local functionality | **GO for covered certified workflows**; new targeted local checks passing |
| Protected Preview deployment | **NO-GO**, engineering/configuration/runtime-proof and approval gates unresolved |
| Four-persona hosted UAT | **NO-GO**, 84 scenarios blocked; identity, entry and hosted verification missing |
| Production release | **NO-GO**, neither authorized nor certified |

The receipt and allowlisted `dist/b631-b650/unified-review.zip` consolidate the evidence without private environment files or a deployable repository upload.
