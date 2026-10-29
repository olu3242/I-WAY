# B902–B1000 — exact-target activation approval package

Owner designation approves UAT project `zolwjyhbfsxbdwyiwkbt`. It does not approve migrations, privileges, accounts, delivery, Vercel settings or deployment. Production and the public waitlist remain excluded.

## Dependency graph

Recovery owner/compatible restore evidence → authenticated management connection/CLI permission → exact eight-migration approval → independent schema/RLS verification → separate Auth/broker/durable-engine/management schema approvals → restricted credentials → Preview configuration → canonical identities/hierarchy/MFA → protected Preview release → individual external access → actual hosted acceptance.

The eight CLI migrations alone do **not** install the full authentication/session, broker, durable engine or invitation-management contract. Do not enable the application after merely obtaining an eight-row migration history.

## Exact SQL source package

`migration-manifest.json` preserves order, raw file SHA-256 and LF-normalized SHA-256 for all eight migrations. Compare against the secure prior migration-certification CSV and the reviewed Git commit immediately before execution.

Separately reviewed dependencies are:

- `db/review-only/iway_auth_role_b513.sql`, `docs/certification/b446-supabase-auth-tenant-roles-staging.sql`, then `db/review-only/iway_private_auth_sessions_b512.sql` (current hardened contract, not older B460 schema).
- `db/review-only/b631-broker-remediation.sql` as the reviewed first-install broker installer, with its restricted broker role precondition and postflight verification. The historical B574 schema defines the baseline contract; do not blindly apply both installers or use B631 to repair arbitrary drift.
- `db/review-only/b662-operations-engine.sql`, after its base Operations prerequisites and reviewed runtime login/ownership grants.
- `db/review-only/b710-uat-management.sql` for the isolated management plane, never the application runtime.

All dependency hashes are recorded in the receipt. These files retain their review-only status; none was promoted into an automatically applied hosted migration. Runtime validators—not a file's presence—decide readiness.

## Read-only preflight

`IWAY_UAT_DRY_RUN_OPT_IN=true node scripts/uat-migration-dry-run.mjs` verifies the exact ignored UAT link, eight filenames and reviewed normalized hashes, creates a separate CLI workspace, then requests only `db push --project-ref zolwjyhbfsxbdwyiwkbt --dry-run --skip-vault`.

The fresh command is **BLOCKED** by HTTP 403 at the login-role endpoint. Supabase MCP read-only SQL succeeds as management `postgres` (not superuser; CREATE ROLE/database/schema capabilities observed). This does not establish an authenticated application runtime or CLI execution permission. Management owner must repair the precise CLI permission/authentication path privately; do not paste tokens or broaden application credentials.

## Environment and Google checklist

All 13 required Preview variable **names** were found. Secret values were not requested for decryption or certified; only names and scopes were retained. Configure them only for `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, genuine Preview, team `team_zNHlJbJHa4YZFwN4p9lcHzEH`:

| Names | Owner verification |
|---|---|
| `IWAY_AUTH_ENABLED`, `IWAY_UAT_ENABLED` | Keep disabled until approvals and postflight checks pass; no automatic activation. |
| `IWAY_AUTH_SCHEMA_APPROVED`, `IWAY_UAT_SCHEMA_APPROVED` | Exact current schema versions, verified through their runtime catalog validators. |
| `IWAY_STAGING_VERCEL_PROJECT_ID` | Match genuine Vercel project identity; no Production-target override. |
| `IWAY_AUTH_ORIGIN`, `IWAY_AUTH_APPROVED_ORIGIN` | Same exact owner-approved HTTPS Preview origin, no wildcard/path/query. |
| `IWAY_AUTH_DATABASE_URL`, `IWAY_UAT_DATABASE_URL`, `IWAY_OPERATIONS_DATABASE_URL` | UAT project only; three separate restricted LOGIN identities, verified TLS, session port 5432, no admin credentials or inherited privileges. |
| `IWAY_AUTH_PROVIDER` | `google`; this does not enable Google in Supabase. |
| `IWAY_SUPABASE_PUBLISHABLE_KEY` | UAT publishable/anon key, never a service-role or secret key. |
| `IWAY_SESSION_ENCRYPTION_KEY` | Canonical 32-byte server-only key, provisioned privately. |

Preview also contains the **name** `SUPABASE_SERVICE_ROLE_KEY` and legacy generic/provider configuration. Request owner-approved cleanup of privileged application-environment keys; do not touch Production scope. Plaintext values are never included in this package. Generic `DATABASE_URL` and old Google client variables do not establish that gated `IWAY_*` runtime configuration is correct.

Google console redirect requirement: `https://zolwjyhbfsxbdwyiwkbt.supabase.co/auth/v1/callback`. Supabase's application redirect allowlist must separately include the approved Preview `/auth/callback`. Verify verified-email identity, Google subject, canonical Auth UUID, role, tenant, relationship and resource ownership; email matching alone grants nothing. Existing PKCE/state/session and deny tests remain mandatory.

## Approval requests

| ID / owner | Exact target and intended change | Prerequisites / security risk | Verification / rollback |
|---|---|---|---|
| A01 / repository owner | Publish this isolated implementation branch to a draft PR for review/CI under the current request | Fresh two-project trigger inspection and branch suppression; risk: unintended Git deployment | Inspect exact SHA, CI and deployment lists; preserve branch history, revert reviewed change if needed; no merge |
| A02 / Vercel owner | Optional staging Git remediation only if a verified defect exists | None currently required; accidental public deployment risk | Keep disabled Git creation and SSO all; restore prior exact settings if separately approved |
| A03 / recovery/database owner | UAT recovery target and restore strategy | Managed parity gap, populated rehearsal, source hashes, owner/RPO/RTO; cost requires approval | Independent restore/security/service checks; keep source and approved rollback target |
| A04 / database owner | Exact eight UAT migrations, then separately approved dependency packages | A03; fresh CLI permission/dry-run; privilege/partial-migration risk | Exact history/checksums and runtime catalog validators; stop on first failure, approved restore or reviewed suffix recovery |
| A05 / credential owner | Restricted Auth, broker, Operations and separate management LOGIN credentials on UAT only | Reviewed grants/RLS/ownership; NOLOGIN capability roles are not runtime login evidence | Actual session_user=current_user, TLS, flags/grants/RLS/denials; disable new login/revoke exact approved grant on rollback |
| A06 / Vercel owner | The 13 Preview keys and privileged-key cleanup in isolated staging only | Schema/login proof and secret manager; wrong-project or privilege leakage risk | Names-only report plus fail-closed runtime probes; restore prior private Preview configuration and disable activation |
| A07 / identity-provider owner | UAT Google callback, exact app redirects and privileged-user MFA path | Provider ownership and AAL2 policy; account-linking/redirect risk | Real approved-account PKCE/callback/MFA denial tests; restore exact prior provider config |
| A08 / provisioning owner | Four approved canonical identities, carrier/fleet/employment relationships and governance namespace | Roster path exists; actual identifiers and approvals missing; role escalation/privacy risk | Independent UUID/subject/tenant mapping and fifth-user/cross-tenant denial; deactivate grants/accounts, preserve audit |
| A09 / management/delivery owner | Separate management process, invitation provider, approved sender and one scoped issuance | Provider/sender/owner unidentified; token delivery/duplicate issuance risk | Expiry, single-use, revocation, retry and delivery proof without logging proofs; revoke unused invitation, disable issuer |
| A10 / release owner | One protected genuine Preview of the exact candidate SHA/archive | A03–A09 and green exact-SHA CI; Production prohibited | Packaged fail-closed checks, hosted API/data/browser validation; disable new candidate and restore approved previous Preview |
| A11 / access owner | Individually authorized external access to the exact protected Preview | Approved tester IDs, expiry and revocation; no SSO removal/team auto-membership/bearer bypass | Each tester reaches application and only assigned scope; revoke each exact grant and associated sessions |
| A12 / public owner | No action within this task | Public/Production changes excluded | Separate future authorization required |

Every hosted approval must name its operator, exact target, reviewed commit/hash, expiry, prerequisites and rollback. No passwords, access tokens, invitation links, MFA secrets or personal roster data belong in the approval response.

## Hosted execution matrix and human work

The 95 existing hosted case identifiers are retained with BLOCKED status. Test Google/password/setup/recovery, refresh/logout/revocation, AAL2, four-persona navigation and logistics/finance, unauthorized/fifth-user and cross-tenant denial, idempotent retry/offline replay, feedback and onboarding persistence. Do not execute against the public project or reuse its identities.

The 48 human accessibility scripts, three feedback accessibility tasks and four real-user acceptance records remain NOT RUN. Their existing source locations and hashes are recorded. Native browser/axe scans are supplemental evidence, not screen-reader or complete WCAG certification. Canonical Figma file/version/exports remain unavailable; visual conformity percentage is not measured.

## Final read-only state reconciliation

UAT changed from zero Auth users initially to two email identities at final inspection. Both are unconfirmed; zero verified MFA factors were found. No personal identity fields were retrieved. This execution provisioned none of them. Canonical roster/Google subject mappings remain unverified, and application schemas/history remain absent. The original empty backup does not cover the new records; obtain a current protected backup and verify its recovery path before any hosted mutation.
