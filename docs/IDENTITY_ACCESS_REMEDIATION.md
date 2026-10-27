# Identity access remediation — 2026-10-19

## Scope and baseline

Repository: olu3242/I-WAY. Base main: 4f5a3a6bd82aa3d220ded562fd3f777ddb738b51.
Branch: fix/iway-e2e-identity-access-remediation. Separate worktree preserves pre-existing website/brand edits in the original checkout. No production writes, live emails, real account provisioning, or merge to main.

Reviewed open PRs #2, #9, #10, #14 and #15 and fetched remote branches. The existing consolidation branch contains reviewed conflict recovery; adopted only its conflict resolutions through 3f4296d plus its support-route regression and conflict gate. Did not merge its unrelated tracking, QA-persona or hosted work. Main contained committed conflict markers in 24 source/configuration files. Retained administration routes, configured authorization, AI policy checkpoints, bounded worker selection, document integrity, explicit notification opt-in, tenant locks/TLS and offline driver extensions. Existing Node regression baseline after reconciliation: 535 passed, zero skipped.

## Implemented behavior

- Existing carrier/fleet/driver names retained. Platform role introduced for the genuine BR-008 gap. Its two explicit permissions are platform:invite and platform:audit. Generic operational authorization always denies that role, including the operations state projection. No RLS bypass or tenant-data support grant was added.
- Platform reviewer bootstrap is a trusted server provisioning prerequisite in a separate governance tenant, with an approved issuer/subject binding. There is no public bootstrap endpoint. Carrier user creation cannot mint platform accounts, even with an empty grant list.
- Invitation creation requires a current persisted session and server-owned reviewer authority. Tenant comes from that principal. Fleet employment comes from the reviewing fleet. Carrier staff may invite direct carrier drivers, but cannot take over fleet driver employment. Approved issuer/subject mapping must be separately reviewed; email metadata is never authorization or recipient proof.
- Created → sent → opened → verified → accepted → active events persist with append-only audit. Alternative expired/revoked/rejected/failed states are supported. Expiry is enforced at use; inspection and subsequent creation persist lazy expiry cleanup.
- Tokens use 32 random bytes; only SHA-256 hashes persist. Resend rotates tokens, remembers every request key, limits sends to five per invitation with a minute interval, and preserves the original bounded expiry. Creation is limited to ten per reviewer per hour. A consumed invitation cannot issue another account: repeat acceptance is rejected rather than issuing a fresh credential.
- Enrollment verifies a signed configured issuer/audience/subject proof. It creates an identity-only account: no password is generated. The account receives only the reviewed stored assignment. No local-password login is possible for that account. First login uses the identity endpoint and existing hashed sessions, idle/absolute expiry, authority fingerprints and CSRF controls.
- Platform enrollment and every privileged platform action require verified MFA. Driver activation creates an unapproved driver record; dispatch remains gated by carrier approval and compliance. Suspension immediately deletes sessions, advances authority version and retains the account.
- SQLite BEGIN IMMEDIATE serializes acceptance and atomically commits account, binding, token consumption and audit. Four concurrent workers using separate database connections produce one account. A failed audit write rolls back enrollment, allowing retry.
- Only the branded mock invitation transport is accepted. Missing/live transport configuration fails closed. No endpoint accepts provider configuration, client tenant assignment or unverified role claims. Unauthenticated enrollment routes have per-IP request limits; authenticated routes require same origin and CSRF.
- The public site remains an honest preview with no configured endpoint. Fixed mismatched form handler, preview messages, menu controls and CSP-incompatible inline initialization. Restored source-driven page generation to verify; regenerated pages account for the larger HTML diff. Public assets contain no internal onboarding details.

## API and runtime boundary

makeOperationsApp accepts trusted server options identityVerifier and invitationTransport. Default startup has neither: federated onboarding fails closed until explicitly configured. The transport currently supports isolated mocks only. No live provider has been approved or implemented.

POST /api/ops/identity-login accepts identityToken. Public same-origin POST invitation endpoints open/reject take token; accept takes token and identityToken. Tokens belong in JSON bodies, never URLs. Authenticated CSRF-protected invitation endpoints create/send/revoke/inspect operate on reviewed records. Platform governance POST accepts audit or suspend and requires MFA.

The API workflow is tested end-to-end. A dedicated browser invitation/enrollment UI is NOT RUN / not implemented; IdP enrollment is a separate prerequisite. Existing operations browser journeys remain covered.

## Database review and migration boundary

Target production reference vnoxdinldneeczxibicp was not contacted or modified. Hosted certification: BLOCKED / NOT RUN. No hosted credentials or authorization were used.

Reviewed the four existing operations migrations and the restricted asynchronous adapter. operations_private enforces tenant scope, active-principal/self restrictions, actor-owned session/audit evidence and immutable audit/command history. The runtime rejects owner/BYPASSRLS roles and verifies TLS. The early-access registration identity is never used for onboarding.

The synchronous SQLite runtime adds invitations and invitation_deliveries using additive CREATE IF NOT EXISTS statements. These are local migrations only. Backup the SQLite file before starting this branch against an existing non-production workspace. No PostgreSQL invitation migration or account-administration grant was applied or invented: the existing adapter explicitly lacks that capability. Hosted invitation persistence, IdP configuration, bootstrap governance, restricted provisioning credentials, RLS acceptance under recipient enrollment, recovery and live delivery all remain certification prerequisites. Do not attach this synchronous service to the async PostgreSQL adapter.

This is local API readiness, not production-ready hosted certification. Supabase's RLS reference confirms that grants and row policies are separate gates: https://supabase.com/docs/guides/database/postgres/row-level-security . No service-role bypass is an acceptable solution to the provisioning gap.

## Approved non-production onboarding plan — no accounts created

| Recipient | Existing/new role | Required trusted records before activation |
| --- | --- | --- |
| martin@tm88investments.com | carrier | Approved carrier tenant ID, issuer and subject [TBC] |
| info@tm88investments.com | fleet | Approved carrier and active fleet relationship, issuer and subject [TBC] |
| oadeyemo306@gmail.com | platform | Separate governance tenant and MFA identity, reviewed bootstrap authority [TBC] |
| cassiomey@gmail.com | driver | Verified employer/fleet or direct carrier employment, issuer and subject [TBC]; dispatch approval separate |

All executed tests instead use illustrative.invalid recipients and ephemeral signing keys. No invitation was delivered to these approved real addresses.

## Execution evidence

| Area | Status | Evidence / limit |
| --- | --- | --- |
| Merge conflicts | PASS | Source conflict gate; reconciled 24 tracked files |
| Source/build | PASS | npm run verify: syntax, source build, 545 Node tests (zero failures/skips), IP scan, site contract |
| Authentication/authorization/isolation | PASS | Existing identity and authorization suites plus four-persona HTTP enrollment |
| Invitations | PASS | Expiry, replay, identity rejection, resend, delivery failure, recovery, concurrency, audit, CSRF and rate limiting |
| Four-persona onboarding | PASS | Synthetic local HTTP create/send/open/accept/first login; scoped access and MFA assertions |
| Database recovery | PASS | Local SQLite transaction/outage retry; 16 disposable PostgreSQL checks incl. pool exhaustion/recovery; no hosted claim |
| Browser | PASS | 11 targeted public-preview and operational journey checks; 390/1440 px and keyboard/no-console assertions |
| CI | NOT RUN | Remote result recorded in PR after push; required Node/browser/disposable PG jobs, no skip-to-pass path |
| Hosted certification | BLOCKED | Non-production IdP/provisioning configuration and PostgreSQL invitation integration unavailable |
| Production access | PASS | No production commands, migrations, accounts or emails executed |
| Pull request | NOT RUN | URL and final commit evidence recorded after publication |

Commands: npm run verify; node --test tests/operations-invitations.test.mjs tests/operations-identity.test.mjs; IWAY_OPERATIONS_LOCAL_OPT_IN=1 npm run test:pg:operations:local; npx playwright test tests/browser/early-access.spec.mjs tests/browser/operations.spec.mjs. Environment opt-in syntax varies by shell. Exact final totals and commits are recorded in the PR and evidence JSON.

Initial failures were retained as findings: release gate expected a configured API despite blank public configuration; browser journey filled a form before the previous command replaced it; new HTTP integration initially omitted session initialization and used a stale synthetic clock. All were corrected before final validation.

## Rollback and release

Do not merge or deploy automatically. Review the PR and require all three remote jobs. For local rollback, stop the process, restore the pre-change SQLite backup and prior code together. Do not discard audit evidence or hard-delete accounts as a rollback tactic. Existing identity-only accounts must not be used with older code that does not recognize their credential sentinel. New tables can remain inert if reverting code; preserve evidence. No hosted rollback is needed because no hosted change occurred.

Platform suspension requires a different MFA platform reviewer; initial reviewer recovery needs an explicitly governed provisioning procedure. Durable live-email outbox, distributed rate limiting, hosted account persistence, browser enrollment UX and approved IdP subject verification are unresolved release work, not hidden successful checks.
