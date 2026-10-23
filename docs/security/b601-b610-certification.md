# I-WAY B601–B610 — Integration and certification

Local covered workflows: GO. Hosted UAT: NO-GO. Human assistive-technology certification: NOT RUN. No production changes, provisioning, invitations, access grants, deployment, merge, billing changes or bypass credentials were performed.

Worktree: `C:/Cdev/I-WAY/pkg/.worktrees/b561-b580-external-uat` (the existing Git worktree, correcting the supplied `pkg.worktrees` spelling). Branch: `work/b561-b580-external-uat`.

| Source checkpoint | Exact commit |
| --- | --- |
| Starting state with 26 pending files | `64fe0aaf7f181d2a9f926f2e7d41d6dfde44c1bd` |
| B602 reviewed 26-file candidate | `70f16c9a33834d81f63bff180d7039201476a016` |
| Final tested implementation and handoff | `f2823e3c499aa49e86d45738c9e54d79c17256c6` |

This report and its receipt are a separate documentation commit. The tested implementation SHA above is stable; the receipt records exact changed paths and hashes, without a circular reference to its own commit. Older B591–B600 reports/receipts remain historical snapshots; their original uncommitted-state wording does not describe the final branch.

| Batch | Result | Evidence / limit |
| --- | --- | --- |
| B601 | PASS | All 26 files present; zero drift against saved source hashes; zero configured-secret matches. All earlier 18 candidate files preserved. Independent baseline rerun: 805 repository, 40 browser, 41 PostgreSQL checks pass. |
| B602 | PASS local | Exactly 26 reviewed files committed as `70f16c9...`; no reset/clean/discard. Push held at the deployment boundary described below. |
| B603 | PASS local / BLOCKED hosted | Both Google and password setup/login exercise existing native application sessions for all four synthetic personas at 390/1440. Privileged MFA, refresh, CSRF rotation, admin mutation and logout pass. Existing revocation/replay/identity-binding negatives remain passing. Real Google consent and external identity testing remain blocked. |
| B604 | PASS reconciliation / BLOCKED provisioning | Fresh aggregate query: 0 Auth users, 0 Google identities, 0 active memberships. Approved four-email roster preserved with null unresolved IDs/evidence and unapproved permissions. No accounts, relationships or subjects invented. |
| B605 | PASS proposal / BLOCKED activation | Fresh metadata: SSO all deployments; latest inspected staging deployment remains READY/Production at `e53192f...`; no Preview names configured. All 12 candidate keys missing in Preview, 10 locally. Preview proposal preserves Production rejection; no environment values changed or decrypted. |
| B606 | PASS selected permutations | Numeric empty/zero/negative/overflow/fraction boundaries; whitespace and chronological validation; malformed JSON/currency/time zone; duplicate submission; failed-save recovery and cancellation. This is an explicit finite selection, not every possible field combination. |
| B607 | PASS automated / NOT RUN human AT | Keyboard-triggered native cancellation and focus restoration, skip navigation, focus/alerts, mobile/desktop checks and 105 axe scans pass. No human screen-reader or physical-device conformance claim. |
| B608 | PASS local | 806 repository, 52 browser, 41 PostgreSQL checks; zero failures/skips. CI now selects full browser coverage and all three disposable PostgreSQL suites. Remote GitHub CI was not triggered or executed in this run. |
| B609 | PASS handoff design / BLOCKED hosted | Protected external access recommendation, provisioning checklist, genuine Preview proposal and 32-case hosted matrix. Every hosted case remains BLOCKED. |
| B610 | PASS evidence package | This report, receipt, source inspection, inventory/coverage artifacts, evidence hashes and an allowlisted local review archive. |

Implemented changes after B602:

- Company administration now reads the current session CSRF token before each mutation and checks the principal against the loaded identity. Saving after refresh succeeds; an identity change is rejected instead of applying a stale form in another session.
- Administration forms suppress concurrent duplicate submissions while preserving recovery after failures. This does not retry a failed mutation automatically or bypass server version/authorization checks.
- Integrated browser coverage now uses both Google and password setup/login for platform, carrier, fleet and driver. Privileged roles complete MFA; each persona reaches its existing role view, refreshes and signs out. The carrier also saves company settings after refreshing an already-open administration page.
- Added four form/keyboard regression journeys. Native prompt dismissal returns focus to the control and records no void; no prompt implementation was replaced or weakened.
- Inventory hashes normalize CRLF/LF differences, with a regression proving identical Windows/Linux inventory output. Previously the committed hashes could drift on Linux despite unchanged source text.
- CI invokes the full browser suite, fails incomplete executable-control evidence, and includes authentication/broker PostgreSQL checks alongside Operations checks. These are repository workflow changes, not a deployment action.

Final local results:

| Suite | Pass | Fail | Skip |
| --- | ---: | ---: | ---: |
| Repository / npm run verify | 806 | 0 | 0 |
| Browser / full Playwright suite | 52 | 0 | 0 |
| PostgreSQL authentication | 18 | 0 | 0 |
| PostgreSQL UAT broker | 7 | 0 | 0 |
| PostgreSQL Operations | 16 | 0 | 0 |

The source/conflict check, build, public IP scan and site structure checks also pass. PostgreSQL checks use genuine restricted TLS logins in disposable clusters. They are not evidence that the currently absent hosted runtime credentials work. The final repository rerun includes the new portability test; the original baseline remains separately logged.

Coverage retains passing outcomes for 40/40 action types, 25/25 forms, 30/30 button labels, 18/18 navigation entries and the disclosure. All 76 inventoried field names are observed; 55 are directly changed in journeys. Unchanged defaults, every field permutation, all HTTP-method/identifier combinations and twelve native-dialog source patterns are not individually certified. Seven UI paths are observed in the DOM ledger; the 48 route/API patterns remain source inventory with separate HTTP/repository tests. A source reference or click alone is not counted as a verified outcome. No unresolved critical UI defect or cross-tenant violation was found in the passing covered journeys.

All four personas use isolated synthetic identities, signed test assertions and local persistence. Real users remain unprovisioned. The HTTPS browser fixture converts intercepted same-origin redirects into fresh navigations; independent HTTP tests assert actual callback responses. Hosted Google integration, externally protected entry and real database runtime certification remain BLOCKED.

Uncovered accessibility scenarios: actual NVDA/JAWS/VoiceOver speech and task execution, native-dialog announcements, screen-reader reading/focus order, physical touch/speech input, 400% zoom/text spacing and disabled-user usability review. Axe reports incomplete findings for manual review; 105 scans with zero violations do not establish WCAG conformance. `b609-hosted-readiness.md` contains the manual execution checklist.

Hosted approvals/prerequisites remain:

1. Real verified Auth UUIDs/Google subjects, native principals, carrier/fleet/employment assignments, independent platform governance namespace and minimum permissions; explicit provisioning and privileged-role approval.
2. Durable hosted Operations persistence, reviewed entrypoint/artifacts, canonical membership/relationship adapters and approved invitation/delivery integration. Local session integration alone cannot solve that architecture gap.
3. Credential-owner rotation of exposed values; secure separate least-privilege auth/broker logins, encryption key and remaining Preview keys; genuine runtime identity/grant/RLS/isolation checks. No administrator impersonation is permitted.
4. Approved genuine Preview source/origin/callback, provider activation and schema changes. The existing Production-targeted staging deployment and its SSO stay unchanged.
5. Owner confirmation of eligible external-collaborator access/plan and four exact-email grants, or separately approved protected private-origin architecture and spend. No shared bypass credential is proposed for human testers.
6. Independent execution of all 32 hosted scenarios, including fifth-user, wrong subject, expired/replayed invitation, MFA failure, revoked access/session and cross-tenant/resource ownership negatives.

The branch is committed locally but not pushed. [Vercel Git integrations can deploy on a push](https://vercel.com/docs/deployments); the available project metadata does not establish that automatic deployment is disabled across linked projects. Your no-deployment instruction remains controlling. A push requires verified disabled Git deployment behavior or explicit authorization for its deployment consequences. No deployment-protection setting was changed to make pushing possible.

Evidence paths and hashes are in `b601-b610-receipt.json`. A local `b601-b610-review.zip` contains allowlisted reports, sanitized evidence and a committed patch for review without pushing. It contains no `.env.local`, credential values or raw provider session material. It is prepared locally, not uploaded or published. No tests were represented as hosted passes.
