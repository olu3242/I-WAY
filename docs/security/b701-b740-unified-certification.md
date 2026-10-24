# I-WAY B701–B740 unified certification

Local covered workflows: **GO**. Protected Preview: **NO-GO**. Hosted UAT: **NO-GO**. Production: **NO-GO**.

One consolidated implementation and certification cycle on `work/b561-b580-external-uat`. Starting commit: `d02189b622fa29961a5d8ab743a68c1178ca1784`, with a clean worktree and no existing B701–B720 implementation. The ending SHA is the enclosing commit, recorded literally with artifact checksums in `dist/b701-b740/post-commit-verification.json`. A tracked file cannot contain its own commit SHA without changing that SHA.

No push, deployment, merge, real account creation, membership assignment, live invitation, credential rotation, hosted SQL/schema change, billing change or deployment-protection change was performed.

## Implementation and boundaries

| Scope | Implementation and evidence |
| --- | --- |
| Baseline and deployment safety | Independently checked five baseline source hashes, eight evidence hashes, 81 packaged Git blobs and 86 artifact files. Baseline archive SHA-256: `c3233b5a82306629a3425eb890dd61714870745344408204ba076da732291bb7`. Existing evidence was preserved. |
| Management-plane invitation issuance | Separate server-only factory with fresh owner approval, pinned project/origin/roster digest, exact administrator UUID, AAL2, `platform:invite`, target authorization and current membership checks. Rechecks authority and relationships across provider work and delivery. |
| Confidential delivery | Fixed approved `/uat/setup#<opaque-handle>` link; confidential injected transport, stable delivery idempotency identifier, bounded timeout and abort signal, sanitized errors. No link/proof/token is returned, logged or stored by the management command ledger. Tests use a mock transport only. |
| Identity verification | Pinned Supabase admin client; fetch existing user by canonical UUID before recovery-link generation. Correct the shared Google identity parser to use the documented `id`/`identity_data.sub` provider subject; keep `identity_id` distinct. Require confirmed approved email, exact canonical user and subject. No signup, identity linking, new role, account creation or password generation. |
| Persistent command custody | Separate PostgreSQL management metadata schema/role; actor-context RLS and FORCE RLS; one unresolved command per target, transaction/advisory locking, fingerprint conflicts, immutable command identity and terminal transitions. Eight concurrent attempts generate one delivery. |
| Failure and replay control | Completed retries return metadata without resending. Unknown or timed-out outcomes fence the target and invalidate broker proofs/sessions. Crashed/expired claims never automatically resend; owner-reviewed reconciliation is required. |
| Existing authentication | Reused one-time expiring setup, minimum password policy, single-use MFA, Google/password canonical identity, PKCE, encrypted broker proofs, session epochs, refresh, recovery and revocation. No authorization or MFA bypass was added. |
| Browser remediation | Fixed same-document setup-fragment handling: opening another setup fragment updates the in-memory handle, clears the URL fragment immediately and resets the form. Eight managed browser cases cover four personas at 390/1440 px. |
| PostgreSQL recovery | Added fixture-only actual database restart support. Durable Operations tests now verify resources, command idempotency and audit across an actual server restart, retaining tenant denial. Management/broker state and uncertainty fences also survive an actual server restart. |
| Delivery safeguards | Root Vercel config disables automatic Git deployment for this exact feature branch. Source/CI verification enforces that rule and the public-only output directory. An opt-in pre-push hook refuses outgoing refs; existing Git hook configuration was not overwritten. |

The management code is a **separate process capability**, with explicit injected owner approval, restricted metadata connection, pinned privileged provider client and confidential transport. No management route, admin secret or fourth application credential was added to the UAT application. The application artifact does not import or package the management modules or SQL. Its hosted issuance adapters remain denied. An owner must choose and configure the separate management host, approval source, provider client and delivery transport before activation; none is auto-enabled by environment flags.

`db/review-only/b710-uat-management.sql` is reviewed-candidate SQL, exercised only in a disposable local database. It requires a pre-existing, separately approved `iway_uat_management_runtime` metadata identity, with no elevated membership, ownership, DDL or application-table privileges. It is additional to the three application roles, not a replacement for them. No Auth admin key belongs in any database/application runtime connection. The SQL deliberately fails on an existing/partial installation rather than repairing unknown hosted state. Apply only through a separately authorized owner workflow.

The command ledger stores hashes, canonical UUID references, expiry, fencing nonce, status and audit metadata. Encrypted invitation/provider proofs remain in the existing broker store. The management audit is append-only, has no runtime SELECT privilege, and is protected against UPDATE/DELETE/TRUNCATE. Column-grant drift, changed actor policies, disabled audit triggers and unrelated table/function exposure fail readiness. Management connections require the actual restricted login and verified TLS; application runtime checks remain intact. Existing deterministic worker boundaries and human approvals are preserved.

## Two existing Preview deployments

Read-only Vercel inspection confirmed two Git-sourced READY Previews from the starting SHA:

| Project | Deployment | Build output |
| --- | --- | --- |
| `i-way` | `dpl_GgyCAntyykfmfdiXNcRFAr4Ux6vi` | `site/public` |
| `iway-auth-staging` | `dpl_7TR9UuAcJ8Pc4R9CdEJZ4nay1Bio` | `site/public` |

Both use repository-root Git builds and are not deployments of the isolated UAT archive. Public Git deployments currently report enabled; staging reports disabled with repository-dispatch disabled. Both production branches are `main`; neither has an ignored-build command or deployment hook. Staging authentication remains enabled for all deployments. Current settings do not establish what configuration was effective when the earlier Git deployments were created; retain that discrepancy for owner review.

The new exact-branch `git.deploymentEnabled` rule is a repository safeguard for a future approved push. Other branches retain their previous default behavior. It does not authorize a push, replace platform protection or prevent a separately initiated CLI deployment. The opt-in `.githooks/pre-push` is supplied but not installed over existing local hooks. Inspect/reconcile all linked projects and obtain separate push authorization before any outgoing update. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration)

## Environment, OAuth and provisioning readiness

All **13 required Preview keys remain absent**. Local `.env.local` is ignored/untracked, and 11 required local names are missing. Names-only comparison and callback requirements are in `dist/b701-b740/environment-readiness.json`. No values were decrypted, serialized, uploaded or printed. The runtime still requires a genuine platform Preview, exact isolated project and approved HTTPS origin; Production-target restrictions were preserved.

Fresh hosted catalog inspection reports PostgreSQL 17.11; only `iway_auth_runtime` exists among the application/management roles. Broker, Operations and management schemas/roles are absent. The Auth role reports LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and NOREPLICATION. This was an administrative catalog read, not a runtime login. All three actual configured hosted runtime logins, TLS/identity checks and tenant-denial tests remain BLOCKED pending fresh restricted credentials and approved schemas.

There are still zero Auth users, Google identities, active memberships and MFA factors. The previously approved four-email roster remains authoritative but non-executable. Canonical Auth UUIDs, Google subjects, native principals, approved permission subsets, governance namespace, carrier tenant, fleet and Driver employment/ownership records must come from actual approved records. Platform has no carrier/fleet assignment; the other three share the intended recorded synthetic hierarchy. No IDs or memberships were invented.

The current public JWKS endpoint returned HTTP 200 with one ES256 public signing key, and the candidate verifier loaded it successfully. Local tests validate issuer/audience/signature/expiry, callbacks/state and explicit subject binding with synthetic keys. This does not certify a real Google login. Google Console/Supabase private callback, signup and linking configuration remains owner-verification work. Required provider callback: `https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback`; application callback: exact approved isolated Preview origin plus `/auth/callback`.

Platform and Carrier still require AAL2 and a pre-existing verified TOTP factor. No live factor enrollment was attempted. Password setup creates no application session; the user signs in after setup and completes required MFA. Successful Google authentication alone never authorizes tenant access. Privileged link generation uses the existing-user recovery mechanism with separate delivery; it does not send provider invitations automatically. [Supabase generateLink reference](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)

Individual external collaborator access remains unapproved/unverified. Retain Vercel authentication and commit-specific individual grants. Current Hobby permits one external collaborator at a time; simultaneous access for all four requires a separately approved eligible paid plan. No shared bypass link/token, team membership, access grant or paid upgrade was created. [Vercel sharing documentation](https://vercel.com/docs/deployments/sharing-deployments)

## Regression and certification evidence

| Category | Final result | Counting and scope |
| --- | --- | --- |
| Repository | **866 PASS, 0 FAIL, 0 skipped** | Fresh `npm run verify`, including source, build, tests, public IP scan and site checks. Nineteen new management/guard tests and one provider-shape regression are included, not additive. |
| Browser application/control coverage | **60 PASS, 0 unresolved FAIL** | 52 unchanged cases passed in the full run; eight managed cases passed affected validation. Initial four navigation-context failures were repaired in test assertions. The last SDK-fixture run passed seven cases and had one execution-delay timeout; that unchanged case passed its targeted rerun. Preserve raw and reconciled evidence; this is not a claim of one 60/60 run. |
| Durable PostgreSQL browser | **16 PASS, 0 FAIL** | Separate actual Operations PostgreSQL mode with synthetic identity provider. Same lifecycle scenarios overlap the general browser suite; do not add to unique workflow totals. |
| Isolated PostgreSQL | **79 PASS, 0 FAIL, 0 skipped** | Auth 19, broker 7, Operations contract 16, durable engine 16, broker remediation 11, management 10. Includes parent tests and subtests. |
| Accessibility automation | **121 general scans and 16 durable-mode scans, 0 violations** | General cases are reconciled without retry duplication; durable-mode scans remain separate. Axe passing is not complete WCAG conformance. |
| Hosted E2E | **84 BLOCKED, 0 executed** | Exact existing case matrix reconciled; no hosted application certification claimed. |
| Human accessibility | **48 NOT RUN** | Native dialog, keyboard/focus, screen reader and mobile checklist retained for human execution. |
| PostgreSQL 17 parity | **NOT RUN** | Installed local server binaries are PostgreSQL 18; no PostgreSQL 17 binary is available. Hosted 17.11 was inspected read-only. |

All PostgreSQL work used new disposable loopback TLS databases, generated fixture credentials and actual restricted sessions. Administrators created fixture schema/records only; restricted checks did not use SET ROLE to impersonate runtime identities. No existing or hosted cluster was used for tests. Runtime failures, wrong tenant/actor context, RLS, row/column privileges, immutable audit, transaction rollback, concurrent replay, backend interruption and real server restarts are covered. A replayed engine transaction advances its snapshot version while preserving the same business result and audit; the restart test checks those separate invariants.

The new browser scenarios exercise confidential mock issuance, duplicate suppression, setup-link fragment removal, password setup, privileged MFA, role mapping, denied platform administration for other personas, recovery invalidation and revocation. The general suite retains Google login, sessions, tenant/resource denials and MVP controls. Source inventory was regenerated after the HTTP-source change; no new public feature claim was added. Verified outcomes remain 40/40 actions, 25/25 forms, 30/30 button labels and 18/18 navigation entries. All 76 fields were observed and 55 interacted with; the 48 source route patterns are not a claim of all dynamic HTTP paths being exercised. Native-dialog assistive-technology coverage remains human work.

Initial development failures were resolved: synchronous fixture cleanup handling, stale inventory hashes/line numbers, setup fragment reuse, an incorrect GET authorization assertion, a synthetic clock mismatch, revocation assertions racing expected browser redirects, and PostgreSQL `name[]` role metadata requiring an explicit `text[]` cast for strict policy validation. A pre-existing Windows evidence-fixture race was also corrected: the parent now waits for the worker's exit and SQLite close before deleting its temporary directory. The final browser tests query the loopback server independently of redirecting page JavaScript. No production authorization rule was relaxed to satisfy a test.

There is no grand unique-test total across these categories. Unit, integration, browser, durable-mode and targeted reruns intentionally overlap. Use the receipt's per-suite commands and evidence hashes.

## Security findings, activation gates and rollback

The setup-fragment defect is fixed. The Google adapter previously expected a database-style `provider_id` property instead of the documented API `id`; the shared parser and fixtures now use the current shape and reject crossed user/subject fields, UUID confusion and conflicting compatibility fields. The provider's response model was verified against [Supabase Auth source](https://github.com/supabase/auth/blob/master/internal/models/identity.go). Missing management issuance/delivery engineering is now implemented and locally tested as a separate capability. Live provider configuration, delivery host and owner approvals are still required. Unknown delivery outcomes remain quarantined: do not retry or clear a command fence automatically. An owner must verify provider outcome, revoke any outstanding proof/session as needed and authorize a reviewed reconciliation procedure before reissuing. No generic un-fencing endpoint was introduced.

Before hosted activation, obtain distinct approval for fresh credential replacement/configuration; reviewed Auth/broker/Operations/management SQL and roles; actual four-user identity/relationship/permission records; privileged MFA; private provider callback and linking policy; separate management process and confidential transport; exact immutable protected Preview artifact; and individual external access. Billing, if selected for concurrent access, needs separate approval. No approval implies production access or a merge.

The isolated artifact is built twice from the exact clean ending commit, verified against all extracted files and the ZIP checksum, and scanned for configured private credentials. Management source, SQL, docs, `.env.local`, prototype and internal reports are excluded from that application artifact. The new artifact does not overwrite the B681–B700 baseline. Exact SHA and checksum results are in `post-commit-verification.json` and `iway-staging-manifest.json`.

Local rollback: preserve this committed branch and its evidence. If rollback is requested later, create a new reviewed revert commit from the recorded starting/ending SHA; do not reset, clean, hard-delete records or discard another worktree's changes. No hosted rollback is needed for this run because it changed no hosted state. Do not undo the deployment safeguard as part of an unrelated application rollback. If the review-only SQL is eventually authorized, deactivate/fence actors and retain command/audit history; prepare a separately reviewed schema rollback rather than dropping custody tables.

Required package: `b701-b740-receipt.json`, `dist/b701-b740/hosted-test-matrix.json`, `environment-readiness.json`, browser/PG evidence and `post-commit-verification.json`. The receipt lists every changed file and source/evidence hash. Local covered workflows remain **GO**; Protected Preview, hosted UAT and production remain **NO-GO** until their actual gates and E2E checks pass.
