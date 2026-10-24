# I-WAY B781–B800 — Activation and E2E certification

**Local covered workflows and approval review: GO. Protected Preview activation, external UAT and production: NO-GO.**

Branch: `work/b561-b580-external-uat`; worktree: `C:/Cdev/I-WAY/pkg/.worktrees/b561-b580-external-uat`.
Starting SHA: `6f322e5315dd6846d9d09b6c86efc4f276aeb366`; starting worktree clean. Ending SHA is the commit containing this report and receipt; its literal value, clean Git state, changed-file manifest and immutable artifact checksum are recorded in `dist/b781-b800/post-commit-verification.json`. The sidecar avoids a circular receipt self-hash.

No push, merge, deploy, hosted migration, secret change/rotation, real account or MFA enrollment, invitation, external grant, billing change or protection bypass occurred. No live management issuer/delivery adapter was activated. Read-only catalog/project observations and public JWKS loading are separate from application E2E.

## B781–B785 — Approval reconciliation

| Batch | Result and evidence |
| --- | --- |
| B781 | PASS baseline: prior receipt/post-commit binding, 12 source/SQL hashes, 40 evidence hashes, 81 package blobs and 86 artifact files verified. Prior ZIP remains byte-identical to its reproduction: SHA-256 732965033770d0663f7984e0ba4206685a2905006ff6f2b010029728c9d236fb. |
| B782 | PASS reconciliation: all A01–A12 identifiers and original target/change/owner/dependency fields preserved. Source B761 document LF hash: 3fb3055b6b7658948f15533a1e4fd38041837f7efed6b802d2dc38c54d644013. All owner decisions still pending. |
| B783 | PASS graph: 12 nodes, 20 dependency edges, acyclic order. Optional A01/A02/A12 remain independent; an order does not authorize execution. Graph and full records are in b781-b800-approval-register.md. |
| B784 | PASS read-only Vercel inspection: staging SSO all, Git creation/dispatch disabled; public Git enabled; both main production branch, null root/ignored-build overrides, no deploy hooks. Existing false branch suppression retained. Hosted application protection was not bypassed. |
| B785 | PASS register preparation: authorized local/read-only/test/evidence/commit work is listed separately from all 12 owner-gated actions. No current request is treated as a mutation approval. |

Remote feature branch still advertises d02189b622fa29961a5d8ab743a68c1178ca1784; starting local HEAD is three commits ahead and zero behind. Remote main advertises 4f5a3a6bd82aa3d220ded562fd3f777ddb738b51, an ancestor 360 commits behind starting HEAD. No fetch or ref update occurred. Final read-only remote reconciliation is included in the post-commit sidecar. The optional local pre-push hook remains uninstalled; no Git configuration was changed.

## B786–B790 — Database/environment preparation

| Batch | Result and boundary |
| --- | --- |
| B786 | PASS names/scope audit; configuration BLOCKED: all 13 effective staging Preview names absent. Ten legacy staging names are Production-only. Values were neither decrypted nor copied. |
| B787 | PASS limited administrative catalog comparison: 33 required auth column names/types match; five auth tables ENABLE/FORCE RLS, five auth policies, nine table grants. Genuine runtime login and hosted tenant enforcement remain BLOCKED. |
| B788 | PASS prepared: 10 exact SQL review copies/checksums across existing-auth review, broker, Operations and separate management packages; execution contract and rollback-procedures.md. Zero hosted SQL execution. |
| B789 | PASS local PostgreSQL17.11: seven disposable suites, 79 leaf scenarios (86 Node checks including seven parents), actual restricted identities, RLS, idempotency and rollback/restart resilience. |
| B790 | PASS secret-safe checklist below and environment-contract.json; private value validation, restricted credentials and exact origin approval remain BLOCKED. |

Project pin: `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, team `team_zNHlJbJHa4YZFwN4p9lcHzEH`, genuine **Preview only**. The public project is `prj_0vutnbiNCYaxhdrbLfktrsHAvxty`; it is not the application activation target.

| Required name | Recommended type | Validation rule | Preview |
| --- | --- | --- | --- |
| `IWAY_AUTH_ENABLED` | Config | Exact true; owner approval required | Missing |
| `IWAY_AUTH_SCHEMA_APPROVED` | Config | Exact b512-v4 | Missing |
| `IWAY_STAGING_VERCEL_PROJECT_ID` | Config | Exact staging project; match genuine VERCEL_PROJECT_ID | Missing |
| `IWAY_AUTH_ORIGIN` | Config | Exact HTTPS origin; no credentials, path, query or fragment | Missing |
| `IWAY_AUTH_APPROVED_ORIGIN` | Config | Exact match to IWAY_AUTH_ORIGIN | Missing |
| `IWAY_AUTH_DATABASE_URL` | Secret | Pinned PostgreSQL project/database; iway_auth_runtime LOGIN; verified TLS; session port 5432 | Missing |
| `IWAY_AUTH_PROVIDER` | Config | Exact google | Missing |
| `IWAY_SUPABASE_PUBLISHABLE_KEY` | Config | Publishable key or pinned-project anon compatibility key; never service-role/secret key | Missing |
| `IWAY_SESSION_ENCRYPTION_KEY` | Secret | Canonical 43-character base64url 32-byte key; server only | Missing |
| `IWAY_UAT_ENABLED` | Config | Exact true; owner approval required | Missing |
| `IWAY_UAT_SCHEMA_APPROVED` | Config | Exact b574-candidate-v1 | Missing |
| `IWAY_UAT_DATABASE_URL` | Secret | Pinned PostgreSQL project/database; iway_uat_runtime LOGIN; verified TLS; session port 5432 | Missing |
| `IWAY_OPERATIONS_DATABASE_URL` | Secret | Pinned PostgreSQL project/database; iway_operations_runtime LOGIN; verified TLS; explicit port 5432; password at least 12 characters | Missing |

Owner checklist: attest the database target is approved staging and not shared production scope; approve exact application origin; supply fresh restricted values through private channels; configure only the isolated Preview scope; validate value compatibility privately and authenticate each actual runtime LOGIN; enable activation flags only under exact-candidate release approval after all gates pass. Never override genuine VERCEL_ENV/VERCEL_PROJECT_ID to make Production pass. Legacy DATABASE_URL/PGSSL and service-role/OpenAI credentials are not substitutes for the three restricted connections. No env pull/upload was performed.

Hosted PostgreSQL reports17.11. Only iway_private exists among required application schemas; only iway_auth_runtime exists among required runtime roles. Auth users, Google identities, active memberships and verified MFA factors are zero. The existing auth inbound postgres ADMIN edge has bootstrap grantor OID10, ADMIN=true, INHERIT=false, SET=false and matches the unchanged B533 exception. It provides no outbound runtime administrator membership. No edge was revoked or exception broadened. Broker/Operations/management stricter installer/runtime contracts still require an owner-approved provisioning method that satisfies them; automatic managed creator edges may block readiness.

Actual restricted-login verification requires owner-supplied fresh credentials, verified TLS endpoint/database, session_user=current_user=the exact runtime role, safe flags, no DDL/ownership/unrelated grants, exact policy/column grants and scoped RLS negatives. Never connect as an administrator and SET ROLE. Auth uses B533 plus assertAuthDatabaseReady/postflight; broker uses B631 verifier/assertUatPostgresRuntime; Operations uses actual durable-engine health and tenant/principal tests. These hosted logins were not attempted. Existing private early_access_leads is outside the five-table auth contract and was not changed.

The SQL execution package names exact source files, canonical LF SHA-256, review-copy paths, staging target, approval IDs and preconditions. Auth is existing-role/schema read-only review, not a B513/B446 replay. Broker uses B631 first-install-or-verify, not a second B574 CREATE SCHEMA. Operations uses four ordered versioned migrations through applyOperationsMigrations(approvedOwnerPool), preserving its checksum ledger, then B662. Applying the four review copies directly omits that ledger and is not the execution procedure. Management B710 remains a separate process/schema/role under A09.

Each migration transaction rolls back on its own failure. Earlier successfully committed Operations migrations remain if a later migration fails; no all-or-nothing sequence rollback is claimed. Stop for owner-reviewed repair, keeping the ledger. After successful installation, proposed rollback disables candidate activation, revokes candidate sessions/proofs and preserves data/audit; no destructive down migration is supplied. No administrator pool, credentials, live runner or automatic execution permission is included.

Local17.11 tests use upstream disposable Windows PostgreSQL binaries and minimal synthetic auth catalog, not a running managed GoTrue service or all Supabase extensions/configuration. The exact three runtime names are checked together in the staging-schema test; existing engine/browser fixtures additionally use their explicitly named restricted iway_operations_fixture login. Tests never impersonate a runtime with SET ROLE. Remote PostgreSQL17 CI was NOT RUN; current remote CI database job remains16.

## B791–B795 — Authentication/onboarding preparation

| Batch | Result and boundary |
| --- | --- |
| B791 | PASS callback requirement review and public JWKS loader observation; real Google sign-in/private settings BLOCKED. Google callback is pinned Supabase /auth/v1/callback; application callback needs the exact approved Preview origin plus /auth/callback. |
| B792 | PASS synthetic canonical UUID/subject, pre-enrolled TOTP requirement, privileged AAL2, recovery/revocation tests; real enrollment and actual AAL2 certification BLOCKED. |
| B793 | PASS integration contract and mocks: separately injected pinned issuer/confidential transport, owner approval digest, exact actor/target/membership checks, durable idempotency/audit and uncertainty fences. Real process/provider/transport identities and activation remain BLOCKED. |
| B794 | PASS four-persona local workflows/isolation; actual memberships/hierarchy IDs unprovisioned. Real identities are not replaced with fixture UUIDs. |
| B795 | PASS serial individual external access/revocation procedure prepared; actual grants BLOCKED. Hobby supports one active external collaborator at a time; no billing change/team membership/bypass link. |

Google's provider callback must be `https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback`. The exact owner-approved Preview origin and Google Console client identifier are unknown; no change to an unidentified client is requested. Private Supabase Google/password/signup/linking/redirect settings remain unverified. [Google setup guidance](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) informs the requirements, not a claim that the settings are installed.

The public loader returned HTTP200 with one ES256 public key. Code pins issuer `https://vnoxdinldneeczxibicp.supabase.co/auth/v1` and audience `authenticated`; no tokens, real OAuth callback or session were used. Canonical mapping requires verified Auth user.id=identity.user_id and Google identity.id=identity.identity_data.sub; identity.identity_id is a distinct UUID. Email confirmation or allowlisting alone cannot create/link/authorize the account. PKCE state/expiry/replay, issuer/audience and wrong UUID/subject denials are local synthetic evidence only.

Platform/carrier require pre-enrolled verified TOTP and cryptographically verified AAL2. Current app has no enrollment surface; an owner-approved controlled enrollment route/tool remains a prerequisite. [TOTP requirements](https://supabase.com/docs/guides/auth/auth-mfa/totp) guide the later procedure: canonical user verification, private tester enrollment/verification, then actual app AAL1 denial/AAL2 success plus recovery, stale-session and membership-revocation negatives. No real factor was enrolled and no QR/seed/OTP was recorded.

The roster remains oadeyemo306@gmail.com (platform control plane, no carrier/fleet), martin@tm88investments.com (carrier), info@tm88investments.com (fleet under that carrier), cassiomey@gmail.com (driver with active employment in that fleet). Actual canonical UUIDs, Google subjects, native principals, governance/tenant/fleet/employment IDs and permission approvals remain null/pending in the preserved manifest. Existing synthetic UUIDs/subjects are labelled fixture-only. New tenant provisioning and actual MFA enrollment are not certified.

Management integration uses existing-user getUserById and recovery generateLink only; no signup/create/invite autosend. An approved separate process injects administrator/client/transport credentials, never the application Preview. Confidential send accepts destination/message/idempotency key/abort signal and returns accepted=true; no proof/token is returned or logged. Owner approval binds exact roster digest, actor UUIDs, origin, operation scope and a maximum24-hour validity. Ambiguous delivery stays fenced without automatic retry. The hosted application's issuance adapters remain denied. No live invitations or emails were sent.

External access plan uses exact commit-specific protected Preview and individually approved Vercel accounts, one tester at a time; revoke and verify deployment denial before the next. Application Google/password authorization remains separate. [Vercel sharing](https://vercel.com/docs/deployments/sharing-deployments) documents the Hobby limit. Concurrent four-user access would require separate billing approval; [Pro pricing](https://vercel.com/docs/plans/pro-plan) starts at USD20/month plus applicable usage/tax. No plan upgrade was made or included in the serial plan.

## B796–B800 — Execution and final candidate

| Batch | Actual result |
| --- | --- |
| B796 | All84 cases reconciled to infrastructure, action IDs and binding requirements. Runtime identity requires A03; DB isolation A03/A04/A05/A08; share revocation A10/A11; password/invitation/recovery paths include A09. All currently BLOCKED. |
| B797 | Four authorized read-only observation groups passed: project/protection/Git metadata, env names/scopes, administrative schema/role catalog, public JWKS loader. Zero full application UAT cases executed. These observations are not counted as hosted UAT PASS. |
| B798 | All final local regression/security suites pass; exact counts below. |
| B799 | This report, full12-action register, machine risk register and exact-source/evidence receipt prepared. |
| B800 | Local validated commit; exact final SHA, artifact hashes, independent ZIP verification, fail-closed startup probe and clean worktree are bound in the post-commit sidecar. No external mutation. |

HOST-080 requires an actual individually approved share and authorized revocation; anonymous HTTP metadata would not satisfy it. HOST-081 requires both platform and application authorization at the approved deployed origin. HOST-082/083 require real restricted logins/approved isolated DB fixtures. No such full case is currently safe/runnable on this undeployed candidate. All84 are recorded BLOCKED with zero PASS/FAIL/NOT RUN. The48 human accessibility scripts are NOT RUN, with hosted execution gates BLOCKED.

## Exact tests, implementation and limitations

| Layer | PASS | FAIL | Skipped | Counting |
| --- | ---: | ---: | ---: | --- |
| Final npm run verify | 878 | 0 | 0 | Includes nine new approval-register regressions; source/build/IP/site checks pass. |
| General Playwright | 60 | 0 | 0 | One complete fresh run. |
| PostgreSQL17.11 | 79 leaf scenarios | 0 | 0 | 86 reported Node checks minus seven orchestration parents. |
| Durable PostgreSQL17 browser | 16 | 0 | 0 | Repeats16 general lifecycle case identities; not added to60 distinct browser cases. |
| Focused management/provider/preflight | 29 | 0 | 0 | Already included in878; not added again. |
| Hosted application E2E | 0 | 0 | 0 | 84 BLOCKED; zero executed. |
| Human accessibility | 0 | 0 | 0 | 48 NOT RUN; no human conformance certification. |

Axe:121 general scans and16 durable variants, zero violations in each. Controls:40/40 actions,25/25 forms,30/30 button labels,18/18 navigation entries with explicit outcomes. Inventory retains48 source route patterns,76 fields (55 interacted) and12 native dialogs; no universal field permutation, dynamic route or human AT coverage claim. No grand total is claimed across overlapping layers or repeat runs.

New `scripts/check-uat-approvals.mjs` reads the tracked B761 matrix, checks exact A01–A12 identities, complete/nonambiguous fields, pending decisions, source digest and dependency graph. It is a read-only preparation validator; it cannot authenticate an owner, grant permissions or execute hosted operations. Its new-run result builder retains validated persona binding requirements while refusing to treat local/historical PASS claims as hosted execution. New `tests/uat-approval-register.test.mjs` covers missing/duplicate/unknown IDs, ambiguous fields, missing rollback, changed decisions, cycles/invalid dependencies, forged authority, invalid case references and local-result promotion. The full suite passed after the final change; earlier development runs are not added to final counts.

Application/UI/auth/runtime/SQL/CI source and existing guards are unchanged. Internal docs, SQL review copies and fixtures are excluded from the application delivery package. Secret review scans configured private credential/decoded password exact matches and selected secret formats without outputting values; it includes generated SQL/evidence. .env.local remains ignored/untracked and was not printed, copied, uploaded or committed. This is a bounded scan, not a universal secret guarantee.

## Twelve-action status summary

| ID | Scope | Action | Current owner status |
| --- | --- | --- | --- |
| A01 | Optional | Feature-branch push | BLOCKED — explicit owner approval |
| A02 | Optional | Conditional Vercel isolation repair | BLOCKED — explicit owner approval |
| A03 | Required | Restricted credentials and missing roles | BLOCKED — explicit owner approval |
| A04 | Required | Broker B631 installation | BLOCKED — explicit owner approval |
| A05 | Required | Operations migrations/B662 | BLOCKED — explicit owner approval |
| A06 | Required | Thirteen Preview keys | BLOCKED — explicit owner approval |
| A07 | Required | Provider/callback policy | BLOCKED — explicit owner approval |
| A08 | Required | Identities, hierarchy and MFA | BLOCKED — explicit owner approval |
| A09 | Required | Separate issuer/delivery activation | BLOCKED — explicit owner approval |
| A10 | Required | Exact candidate Preview deployment | BLOCKED — explicit owner approval |
| A11 | Required | Individual external grants/revocation | BLOCKED — explicit owner approval |
| A12 | Optional | Optional public Preview key hygiene | BLOCKED — explicit owner approval |

The full register preserves original targets, changes, responsible owners, prerequisites, risks, verification and rollback. A10’s original text binds the preceding release; a new approval must name the final B781 SHA/checksum from its sidecar. No prior reference is treated as approval for this candidate. Local/read-only/test/evidence/commit permissions are recorded separately; none authorizes A01–A12 mutations.

## Unified risk/dependency register

| Risk | Severity | Actual status | Finding | Required action |
| --- | --- | --- | --- | --- |
| R01 | High | BLOCKED | Broker/Operations roles and schemas absent; genuine hosted runtime logins unavailable | A03,A04,A05 |
| R02 | High | BLOCKED | All13 staging Preview names absent; exact origin and private values unapproved | A06 |
| R03 | High | BLOCKED | Zero Auth users, Google identities, active memberships and verified MFA factors; real UUID/hierarchy bindings null | A07,A08 |
| R04 | High | BLOCKED | Controlled privileged TOTP enrollment route/tool not identified; application requires pre-enrolled verified factors | A08 |
| R05 | High | BLOCKED | Separate management process/actor, provider and transport account not activated or identified | A09 |
| R06 | High | BLOCKED | Candidate not deployed; individual protected external grants unapproved; Hobby allows one collaborator at a time | A10,A11 |
| R07 | High | BLOCKED | Private Google/Supabase callback/signup/linking settings and exact Google client identifier unverified | A07 |
| R08 | Medium | BLOCKED | Broker/Operations/management strict membership checks may reject automatic managed creator ADMIN edges | A03 |
| R09 | Medium | BLOCKED | Public Preview privileged variable names observed; unused-value dependency review pending; no value disclosure/browser leakage established | A12 optional |
| R10 | Medium | NOT RUN | 48 human AT scripts not performed; automated axe does not establish complete WCAG conformance | A10,A11 |
| R11 | Medium | NOT RUN | Remote PostgreSQL17 CI not executed; current remote DB job still targets16 | Separate CI review; no hosted mutation authority |
| R12 | Medium | BLOCKED | Remote feature remains d021 while local source is three commits ahead at start; no local hook installed; historical staging Git flag at old push unknown | A01 optional |

Read-only metadata shows public Preview names DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD. Their values were not read; presence alone does not prove browser leakage. Optional A12 requires dependency verification and Preview-only owner approval before removal; Production is excluded. Supabase17.11 and HTTP TLS-cipher notices were reviewed against unchanged source; no affected SQL feature usage or legacy HTTP cipher override was introduced, and no hosted reindex/configuration change was made.

**Final decisions:** local covered workflows and the exact-source approval package GO; protected Preview, external UAT and production NO-GO. Missing approvals/secrets/identities and unperformed hosted/manual checks remain visible blockers. This cycle stops at the hosted authorization boundary with all independently authorized local work completed.
