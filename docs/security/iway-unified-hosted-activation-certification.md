# I-WAY unified hosted activation — implementation and certification

Local covered workflows: GO. Protected Preview, external UAT and production: NO-GO. No real hosted login has been established. All hosted infrastructure and access changes remain unapplied.

## Candidate and actual deployment

- Starting SHA: 887eeddb33f381733092569fb5d0f2f393b02920. Branch: work/b561-b580-external-uat. Starting worktree: CLEAN.
- Ending SHA: exact literal SHA in dist/iway-hosted-activation/post-commit-verification.json; this report and receipt are committed with the implementation.
- Current staging Preview: https://iway-auth-staging-lyux199ml-eduradiusllc.vercel.app; dpl_7TR9UuAcJ8Pc4R9CdEJZ4nay1Bio; READY; Git SHA d02189b622fa29961a5d8ab743a68c1178ca1784; outputDirectory site/public. It is the older public-site artifact, not this Operations candidate.
- Four real unauthenticated probes (/uat/login, /app, /uat/control, /health) returned HTTP 302 to Vercel /sso-api. These protection observations are separate from application E2E.
- Staging Git builds disabled with repository dispatch disabled; SSO protects all deployments. Public project still enables Git builds, main is its Production branch. No push, deploy, public mutation, setting change, migration, credential rotation, user provisioning, MFA enrollment, invitation, access grant, billing change or merge occurred.

## Completed implementation

1. Fixed Platform Admin audit text overflowing to 423px on a 375px viewport. The protected page uses the existing shared styles, semantic document, skip link, wrapped preformatted output and 44px buttons with visible focus. CSP permits same-origin stylesheet loading; scripts and framing remain restricted.
2. Fixed early/error-state sign-out: the visible button could submit before workspace state existed, sending no CSRF token and receiving HTTP 403. The static sign-out button stays disabled until its script registers a handler. Every POST then obtains a fresh verified session CSRF token; a loaded actor mismatch still stops the request. A deterministic test holds workspace availability at an intentional 503, then checks keyboard sign-out and subsequent 401 session denial.
3. Corrected local synthetic driver/fleet/equipment relationships before fixture assignment. Fleet visibility now exercises an actual permitted assigned shipment. This only changes disposable fixtures; no real tenant/vehicle ownership was altered.
4. Added the 375/768/1440 four-persona suite, real local save/reload and handler restart checks, keyboard navigation/table scrolling, focus restoration, touch-control size/clipping checks and source-bound machine-readable responsive evidence. Updated the existing generated inventory and HTTP fixture assertions.

## Actual final verification

| Suite | Final result | Evidence |
|---|---|---|
| Repository / CI-compatible gate | 878 PASS, 0 FAIL, 0 SKIP | repository-release.log |
| Complete browser suite | 73 PASS, 0 FAIL, 0 SKIP | browser-evidence.json; browser-final.log |
| Durable PostgreSQL browser variants | 29 PASS, 0 FAIL, 0 SKIP; overlaps 29 cases in the 73 | browser-durable-evidence.json; browser-durable-release.log |
| PostgreSQL 17.11 restricted/TLS/RLS/persistence | 79 leaf scenarios PASS; 86 reported Node checks include seven parent orchestrators | postgres17-compatibility.json; seven postgres logs |
| Responsive four personas × three widths | 12/12 local and 12/12 durable variants; 105 layout observations each | responsive-certification.json |
| axe | 136 general scans and 31 durable scans; zero violations | Browser evidence; overlapping states, not full WCAG conformance |
| Actual hosted UAT | 0 PASS, 0 FAIL, 84 BLOCKED, 0 NOT RUN; none executed | hosted-uat-results.json |
| Human accessibility scripts | 48 NOT RUN; none performed | Prior 48 exact scripts retained in dist/b781-b800/manual-accessibility-scripts.json |
| Baseline integrity | PASS: 15 source/schema hashes, 59 evidence hashes, 81 packaged Git blobs, 86 archive files | baseline-integrity.json |

All final test results are independent local reruns. Authentication providers and invitation delivery are synthetic/mocked. Durable browser Operations writes use genuine disposable PostgreSQL 17.11 restricted fixture LOGINs. This is not successful hosted authentication, hosted restricted-login certification, or production parity. Browser and repository counts are separate; subset reruns are not added together.

Exploratory failures are retained in the run logs: platform overflow, stale generated inventory, fixture ownership/setup assumptions, and the newly confirmed early sign-out race. Temporary diagnosis emitted only stack locations and was removed. The authoritative final suites above passed; unresolved hosted prerequisites are BLOCKED rather than FAIL or PASS.

## Interaction coverage and limits

- 40/40 actions, 25/25 forms, 30/30 button labels and 18/18 navigation entries have explicitly asserted local outcomes in passing tests. No unresolved dead controls in those inventoried categories.
- 48 source route patterns are inventoried; this is not 48 independently certified route/method combinations. Runtime DOM observed seven route paths. 76/76 fields observed, 55 interacted; all field combinations remain outside complete certification.
- Twelve native dialog expressions are inventoried. Automated keyboard prompt cancellation is covered; their screen-reader/touch behavior and the 48 human scripts remain unperformed.
- Screenshots contain illustrative fixture data only. 375px Platform Admin and 768px Carrier screenshots were visually inspected. All twelve durable screenshots are retained with hashes. Native touch/assistive technology, real mobile devices, every state combination and complete WCAG conformance remain unverified.

## Owner-confirmed activation blockers

1. Project owner: designate the exclusive I-WAY staging PostgreSQL project/database and administrator/service owner with authenticated management connection location. The public early-access project vnoxdinldneeczxibicp and unrelated Velocity projects are excluded. No catalog query or credential login was performed against them this cycle.
2. Engineering plus database/Auth owner: reconcile current hard pins across DB endpoint validators, issuer/JWKS, provider endpoints and publishable-key checks with the designated target in one reviewed change. Existing strict gates remain in place. The current candidate must not be configured/deployed against the excluded public database.
3. Database owner: perform an approved read-only catalog review on the actual selected target; then separately approve exact broker/Operations/management migration checksums, order, roles, grants and FORCE RLS. Historical SQL packages are not executable approval for the now-excluded target. Actual session_user/current_user for all three hosted runtime roles remain unknown; administrator impersonation is not used.
4. Vercel owner: approve all 13 exact Preview-only values/scope and a fixed HTTPS origin after target code reconciliation. Names are freshly inspected: 0/13 in effective Preview; values are never decrypted or printed. Genuine VERCEL_ENV=preview/project gate must remain intact; do not reuse the older Production alias or override platform target.
5. Google/Supabase and identity owners: review actual provider/client, exact new Supabase callback and app /auth/callback, PKCE/state/redirect settings; approve canonical UUID/Google-subject/native-principal bindings and tenant/fleet/employment/permission IDs for the roster. All real mapping IDs remain null.
6. Management/delivery owner: designate isolated invitation issuer process, approved provider/sender and authenticated management transport. Existing management-plane code and mocked delivery pass local tests; no real provider or sender has been selected. Application runtime invitation issuance remains denied.
7. Privileged platform/carrier testers: personally enroll verified TOTP and complete AAL2 through an approved enrollment route; no such live route is confirmed. The application challenges existing verified factors and does not bypass enrollment.
8. Release/Vercel owner: approve the exact remediated candidate artifact deployment and then individually controlled external access. Hobby currently supports one active collaborator; serial grant, test, revoke, verify denial, then next tester. No team membership, bypass link or billing change is required for that proposal. Four concurrent access would require separate plan/billing review.

## Actual four-persona hosted results

| Persona | Google | Password | Dashboard / isolation / sessions |
|---|---|---|---|
| Platform Admin | BLOCKED | BLOCKED | BLOCKED; canonical control-plane identity and verified MFA absent |
| Carrier Admin | BLOCKED | BLOCKED | BLOCKED; actual tenant/native identity and verified MFA absent |
| Fleet Company Admin | BLOCKED | BLOCKED | BLOCKED; actual fleet/parent tenant mapping absent |
| Driver | BLOCKED | BLOCKED | BLOCKED; actual employment/fleet/tenant mapping absent |

Approved email allowlist is preserved in docs/security/uat-provisioning-manifest.json and four-persona-login.json. Email authentication alone does not authorize a tenant. No identity or tenant identifiers were invented.

## Approvals and recovery

All A01–A12 remain BLOCKED_APPROVAL_REQUIRED with null owner decisions and executed=false. The full original action targets, change descriptions, prerequisites, owners, risks, verification and rollback are retained in iway-unified-approval-register.md, together with a superseding exclusion addendum. A01/A02/A12 remain optional. Local edits/tests/evidence and a local feature-branch commit are authorized.

Before any hosted mutation, bind the eventual exact project/database, source diff/checksums, owner, prerequisites, risk, verification and rollback to an explicit owner decision, SHA and expiry. Failed migration transactions roll back per file; earlier committed migrations and audit are preserved. Disable candidate activation/revoke sessions on postflight failure; no automatic destructive down migration, public change or force-push.

Local UI rollback is a separately reviewed Git revert of this commit if needed, preserving prior work. No hosted rollback was needed because no hosted change occurred. The next safe owner action is designation of the missing database, management connection and delivery provider; an exact activation package can then be reviewed against known targets.

## Changed files

- apps/operations/index.html
- apps/operations/ops.css
- apps/operations/ops.js
- docs/security/b591-mvp-inventory.json
- docs/security/iway-unified-approval-register.md
- docs/security/iway-unified-hosted-activation-certification.md
- docs/security/iway-unified-receipt.json
- server/operations-uat-application.mjs
- tests/browser/evidence-reporter.mjs
- tests/browser/integrated-workspace.mjs
- tests/browser/responsive-personas.spec.mjs
- tests/helpers/uat-application-fixture.mjs
- tests/operations-uat-application.test.mjs

All required generated evidence is under dist/iway-hosted-activation (ignored and not deployed). Source and evidence hashes are in iway-unified-receipt.json. Post-commit verification binds the literal ending SHA, clean worktree, changed manifest, deterministic ZIP, exact four reviewed application-source changes, private-path exclusion and fail-closed unconfigured API probe. No secret values are committed or packaged.

## Decisions

Local covered workflows: GO. Protected Preview: NO-GO. External UAT: NO-GO. Production: NO-GO. The first real hosted login remains blocked by owner-confirmed absent staging infrastructure and action-specific activation approvals.
