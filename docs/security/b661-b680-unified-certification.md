# I-WAY B661–B680 — Durable implementation and local E2E certification

## Candidate and decisions

Branch: `work/b561-b580-external-uat`. Starting commit verified clean: `9d1f2f4b100333953cac9911f4a08e4c9604ec3e`. The enclosing implementation commit is identified exactly in `dist/b661-b680/iway-staging-manifest.json`, which also binds every packaged source blob and the artifact checksum. The receipt lists every changed file. This avoids a self-referential checksum inside the commit it identifies.

Safe local implementation was performed. No Git push, deployment, merge, hosted SQL, account provisioning, invitation delivery, billing change, owner-credential rotation or deployment-protection change occurred. Public site output remains unchanged. Local certification applies to the tested workflows; **protected Preview activation, hosted UAT and production remain NO-GO**.

## Operations implementation (B661–B667, B676)

`DurableOperationsPgEngine` now connects the existing Operations domain engine to authoritative PostgreSQL storage. It validates the actual transaction connection's TLS and restricted identity, sets transaction-local tenant/principal context, obtains a tenant advisory lock, reads one RLS-protected tenant state and audit journal, and materializes the existing synchronous engine into request-local in-memory SQLite. It executes the tested validation, authorization, transactions, idempotency and workflow logic, then commits state and new audit entries to PostgreSQL before returning success. The transient SQLite database is closed on every request; no local file or warm instance owns persistent state.

This is an explicit compatibility implementation, not a normalized rewrite of every business table. PostgreSQL enforces tenant boundaries on the state unit and journal; the application enforces role, permission, fleet relationship and resource ownership within it. Tenant/principal registries are owner-provisioned, read-only to runtime, and checked under RLS. No principal or realm is created automatically. State is versioned and bounded to 32 MiB per tenant, requests within a tenant serialize, and buffered responses are bounded to 8 MiB. This MVP design has not received production-scale performance certification. Migration to normalized business tables can be reviewed separately without claiming that it already exists.

The native schema includes users, resources, commands, sessions, identity bindings, session-security metadata, invitations, deliveries, UAT/native pairings and organization administration. Restoration validates the known schema, ownership, foreign keys and SQLite integrity; native triggers are reinstalled before workflow execution. The core journal is append-only in PostgreSQL, and existing native and administration audit history cannot be shortened or rewritten through the bridge. Failed callbacks, failed persistence and dead connections roll back; broken connections are discarded. No successful HTTP response escapes before commit. Native authentication and authorization are rechecked before successful application responses commit.

Review-only `db/review-only/b662-operations-engine.sql` creates the new schema and reapplies its policies/grants transactionally while preserving data. It requires the separately provisioned restricted `iway_operations_runtime` LOGIN and creates no role, password, tenant, principal or configuration record. Owner-approved realm, principal, initial tenant-state and deployment configuration records are prerequisites. The old `operations-postgres.mjs` async contract remains a distinct tested adapter; its historical readiness label does not describe the new compatibility engine.

Real disposable PostgreSQL tests cover genuine restricted `session_user`/`current_user`, verified TLS, RLS/FORCE RLS, empty and forged context, cross-tenant access, deactivated realms/principals, shipment/dispatch/finance persistence, duplicate and concurrent commands, pool recreation, transaction failure, connection termination, append-only audit and recovery. Browser lifecycle tests also use the real PostgreSQL engine, recreate application assembly after login and inject a persistence-permission failure to verify a 503 response rather than an uncommitted success.

## Agentic status (B665)

Implemented executable roles are `dispatch`, `tracking`, `documents`, `exceptions` and `finance`, coordinated by the existing bounded orchestration, connector and approval services. Four genuine PostgreSQL scenarios verify five-step checkpoints across new pools, replay fencing, human approval, dead-letter retry, cancellation and rejection of injected consequential output. Their results survive application reconstruction. The stateless application now advances at most one exception review and five checkpoints for one advisory job after an authorized, CSRF-validated command. Pending reviews are prioritized ahead of existing requests awaiting human decisions. No timer, unauthenticated worker endpoint or GET-triggered business mutation was added. Connector jobs remain pending until a separately approved adapter/worker is supplied; live delivery is not enabled. Model provenance remains `model=null`, `live=false`; no model inference, external OCR, GPS, messaging or accounting provider execution is claimed.

MAX, PULSE, CLARA, GUARDIAN, FINN, SAGE and ATLAS have no executable name bindings in the inspected application. No mapping was invented. Their product naming/integration remains unresolved if those names are required for release. Exact UI/API/service/storage/audit traces are in `b661-agentic-trace.json`.

## Authentication and security (B668–B670)

Fixed confirmed defects rather than weakening guards:

- Sign-out and replacement consume pending MFA challenges; captured pending cookies cannot complete sign-in afterward.
- Access-token expiry denies ordinary resources while permitting a token-free, absolute-lifetime-bounded refresh preflight.
- Concurrent ordinary checks and losing refresh claims no longer revoke the winning atomic exchange.
- Refresh pins the original canonical user, login method, exact Google subject, current membership and privileged MFA assurance. Drift and uncertain provider outcomes fence the local session.
- The native session refresh guard separately validates its persisted pairing, active principal, authority fingerprint, existing identity binding, idle lifetime and absolute lifetime; expired access alone does not prevent renewal. Native handle and CSRF rotation remain enforced.

Both authentication methods resolve to the same pre-existing native principal. No email-only linking, account enrollment or privileged runtime fallback was introduced. The hosted adapter loads only an owner-approved four-email configuration and validates the shared carrier/fleet hierarchy and governance namespace. It uses public asymmetric project JWKS (RS256/ES256), refreshes the runtime generation after five minutes, and fails closed on unavailable keys or changed approval. Actual project asymmetric key availability and live Google callbacks remain unverified. No legacy JWT signing secret is accepted by this adapter.

Hosted invitation/admin/recovery issuance and mail delivery remain explicitly denied in the entrypoint. Approved, already-issued setup/recovery handles can be redeemed. An authorized issuer/delivery integration and owner approval are still needed to issue real activation or recovery links; merely adding an administrator secret cannot enable issuance. This remaining operational dependency is not represented as completed hosted recovery.

The four approved emails remain the allowlist: `oadeyemo306@gmail.com` (platform), `martin@tm88investments.com` (carrier), `info@tm88investments.com` (fleet), `cassiomey@gmail.com` (driver). Actual Auth UUIDs, Google subjects, native principal IDs, carrier/fleet IDs, employment and governance namespace remain unresolved. Approved email roles do not authorize provisioning or privilege grants. All UUIDs used in tests are explicitly synthetic local fixture identifiers.

## Deployment and environment (B671–B675)

The package builder requires an exact full SHA equal to clean HEAD. It reads committed Git blobs, follows static and literal dynamic module imports, allowlists required Operations assets and CA, and includes the exact production `pg` lockfile dependency closure. Nonliteral imports, symlinks, dirty input, missing dependencies, private environment files, docs, prototype and public marketing source are rejected. A fixed-time sorted ZIP and per-file hashes provide reproducibility. The ZIP is source with a locked production install contract; it is not falsely described as an executed remote Vercel build.

The package binds `.vercel/project.json` to team `team_zNHlJbJHa4YZFwN4p9lcHzEH` and staging project `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`. Git deployments are disabled in its configuration, and runtime rejects a non-Preview target or wrong project before database access. `verify-uat-staging-delivery.mjs` checks the SHA, archive, every file and project/environment binding and returns an approval-required plan; it has no deployment or network execution capability. Negative tests reject the public project, Production target, extra environment files and tampered artifacts.

This selected mechanism creates local files only and performs no Git push, so it cannot trigger the public project's Git integration. A future authorized operator must run from this verified artifact directory with the pinned team/project, never from the repository root. This does not claim that arbitrary future CLI commands or account settings cannot be misused. Existing project-level SSO remains unchanged and must be rechecked before approved delivery.

The twelve original Preview variables remain required. **`IWAY_OPERATIONS_DATABASE_URL` is an additional thirteenth requirement**, using the dedicated restricted Operations identity and verified TLS; neither registration, auth nor broker credentials are substituted. The names/scopes matrix in `dist/b661-b680/environment-contract.json` reuses the dated B611–B620 snapshot, which had no Preview variables. Actual new Operations credentials, engine schema and approved configuration have not been applied or verified hosted. The old Production-target staging alias is not an approved Preview origin. Google-to-Supabase and Supabase-to-approved-Preview callbacks require separate owner verification.

Previously exposed database, service-role, OpenAI and Google OAuth credentials were not used for runtime or testing. Owner-managed rotation, shared-project impact review, secure replacement and post-rotation validation are required. A publishable/anon key is public configuration; do not confuse it with a service-role key. No missing secret was generated, printed or uploaded. The rotation checklist records names and status only.

## Verification (B676–B679)

Final counts and hashed evidence are recorded in `b661-b680-receipt.json`. Full repository regression passed **840/840**, no failures/skips. The full browser suite passed **52/52** with **105 recorded axe scans, zero violations**. The separate real-PostgreSQL browser lifecycle passed **16/16**; one additional targeted PostgreSQL browser case verified the new bounded worker. These repeated cases are not summed as unique business scenarios. All **68 PostgreSQL tests passed**: 19 auth persistence, 7 broker, 16 historical async Operations contract, 15 new durable engine and 11 broker-remediation checks; parent/subtest totals are not presented as independent business scenarios.

The implemented-control inventory was refreshed for the durable routes. It retains 40 actions, 25 forms, 30 button labels, 18 navigation entries, 76 field names, 12 native-dialog patterns and 48 route patterns. Discovery alone is not certification. Full browser evidence and the coverage gate certify meaningful outcomes for enabled in-scope controls. Boundary permutations remain bounded tests, not every possible input combination.

The first full regression attempt failed on a stale inventory and a source-fingerprint mismatch while source edits were still occurring; after inventory refresh and a source freeze the full suite passed. A new PostgreSQL test initially left an expired fixture session behind, affecting a subsequent recovery count; cleanup was corrected and the actual auth suite reran successfully. Browser development exposed missing administration-schema restoration and sign-out routing; both were fixed before the final run. An active-connection termination error was handled and verified by real PostgreSQL recovery tests. Final receipts preserve final outcomes rather than treating these corrected attempts as hosted results.

`hosted-test-matrix.json` preserves all **84 hosted cases as BLOCKED** and **48 human accessibility cases as NOT RUN**. These are prepared cases, not executed tests. Automated axe results do not establish full WCAG conformance. Human screen-reader, native-dialog, physical-device and zoom testing remain outstanding. No real Google login, real tester password activation, live-provider agent action or protected Vercel E2E was performed.

## Approval and rollback gates (B680)

Before hosted activation, separately approve owner-managed credential replacement; exact restricted role/schema/configuration application; real identity/principal/tenant/fleet/employment mappings and privileged MFA; authorized invitation/recovery delivery; approved exact Preview origin/callbacks and provider signup/linking policy; eligible-plan costs and individual external grants; and delivery of the exact final SHA/checksum to the isolated protected Preview project. Deployment authorization alone does not authorize accounts, invitations, billing, Git push or protection changes. Do not merge or promote to production.

Use individual external Preview collaborator access while preserving SSO and application RBAC. The previously inspected Hobby plan supports one collaborator at a time; four simultaneous collaborators require an eligible plan and separately approved costs. Reverify current plan/access capability before any invitation. No team membership or shared bypass credential is created. See the linked official sources in the B631–B650 report and the preserved deployment plan.

Before approved schema work, capture an owner-authorized backup and compatibility/restore evidence. Migrations are additive and owner-applied; runtime never runs them. Before delivery, capture staging protection and alias assignments and identify a compatible independently verified fallback, if one exists. On failure, keep SSO, withdraw the failed Preview from tester use under explicit incident authority, fence affected sessions and revoke shares only as approved. Restore a staging alias only to a verified compatible deployment. Do not blindly restore the old Production-target auth deployment, drop schemas/audit history, or use privileged credentials as a fallback. Public production remains untouched.

| Decision | Result |
| --- | --- |
| Covered local functionality and durable Operations | GO within executed coverage and documented MVP limits |
| Local immutable package | Verifiable source artifact; activation remains approval gated |
| Protected Preview activation | NO-GO until fresh credentials, approved infrastructure/bindings and deployment authorization |
| Four-persona hosted UAT | NO-GO until real identities, protected entry and actual hosted tests pass |
| Production release | NO-GO; not authorized or certified |
