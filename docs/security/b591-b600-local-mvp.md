# I-WAY B591–B600 — Local MVP controls and accessibility

Scope: current implemented private application interfaces, not the internal reference prototype or future product scope. Hosted testing remains BLOCKED. No deployment, merge, provisioning, invitations, billing, Vercel protection or production changes occurred.

Worktree: `C:/Cdev/I-WAY/pkg/.worktrees/b561-b580-external-uat`. The supplied `pkg.worktrees` path was reconciled to the existing Git worktree. Branch: `work/b561-b580-external-uat`. Starting commit: `64fe0aaf7f181d2a9f926f2e7d41d6dfde44c1bd`. Starting worktree was clean: the earlier candidate files were already committed. No resets, cleans or discarded files. This batch remains uncommitted for review; the starting commit does not include these changes.

Machine-readable deliverables:

- `b591-mvp-inventory.json`: source locations/hashes for 40 action types, 30 button labels, 25 forms, 18 navigation entries, 76 field names, 12 native-dialog source patterns, one disclosure and 48 route/API-reference patterns. Counts overlap and are not business-feature counts. Dynamic button expressions are explicitly expanded; source discovery never claims execution.
- `b591-b600-receipt.json`: exact changed paths, source/evidence hashes, test totals and coverage snapshot.
- Worktree `dist/mvp-coverage.json`: per-control passing test references, interaction evidence and explicit outcomes, with unverified entries visible.
- Worktree `dist/mvp-control-evidence.json`: runtime observed controls and interactions. No input values, credentials, cookies, OAuth query parameters or token responses are captured by this collector.
- Worktree `dist/browser-evidence.json`: browser results, source hashes, axe scans, incomplete-rule/manual-review requirements.

Reproduce the source inventory with `node scripts/inventory-mvp-controls.mjs`; run the browser suite with `npm run test:browser`, then `node scripts/report-mvp-coverage.mjs`. `tests/mvp-inventory.test.mjs` rejects a stale inventory. The coverage tool accepts explicit outcomes only from passing tests; a click alone is not certification. Browser artifacts are ignored local files, not deployment inputs.

Implemented fixes:

1. Administration editor retains the returned version after saving; a second edit succeeds instead of using stale version zero. Switching configuration type resets record/version/data and disables deactivation until a record is selected or saved.
2. Configuration removal now retains an audited, versioned deactivation tombstone instead of hard-deleting the row. Inactive permission, field-security and validation rules no longer affect enforcement. Existing `/api/ops/admin/delete` remains a compatibility route with deactivation semantics; the UI says Deactivate configuration. No hosted schema changes were applied.
3. Administration API failures announce an assertive, focused alert and preserve the user's editor input. Routine initial loading does not steal keyboard focus. The skip link now targets a focusable main landmark.
4. Platform audit failures can be retried; the page has keyboard skip navigation, accessible feedback and a working sign-out control. Both buttons handle failures without becoming permanently disabled.
5. Operations mutations obtain the current session CSRF token, which resolves sign-out failures after authentication refresh rotates the native session. A different principal is rejected with a reload message. This neither bypasses CSRF nor retries a mutation automatically.
6. The older advisory workflow browser journey now waits for persisted job creation before worker ticks. This removes an asynchronous test race exposed by session preflight and evidence instrumentation.
7. Browser control evidence uses an automatic per-test fixture. The initial module-level hook missed later test files; that reporting defect was fixed before final coverage was accepted.

Four-persona coverage:

| Persona | Positive local workflows | Negative checks |
| --- | --- | --- |
| Platform administrator | Synthetic signed OAuth, governance audit, retry, keyboard navigation, refresh, sign-out at 390/1440 | Failed audit API, tenant persona denied governance, carrier state denied, native/admin revocation |
| Carrier administrator | All permitted navigation; settings; all seven configuration types; accounts/fleets/customers; driver/equipment approvals; dispatch/document/billing/receivable/advisory workflows | Failed/stale admin saves, cancelled decisions, denied cross-tenant mutation, invalid routes, changed identity/session |
| Fleet administrator | All permitted navigation; employment, equipment creation/edit, notification preference persistence; integrated login/refresh/logout at 390/1440 | Unauthorized carrier pages/commands, stale update, failed/lost response recovery, cross-tenant mutation denied |
| Driver | All permitted navigation; assigned shipment acceptance, pickup/transit, tracking/exception, acknowledgment/delivery; integrated login/refresh/logout at 390/1440 | Commercial field exclusion, forbidden actions, unrelated tenant/resource access, inactive employment and revoked binding/session |

Additional dispatcher/customer journeys are retained because they exercise implemented approval separation, document ownership and customer invoice/notification views. Synthetic fixture permissions deliberately exercise implemented role capabilities; they do not approve privileges for the real tester roster.

Control outcomes include persisted creation and edits, auditable approval/rejection, workflow restart/retry/cancel, document review/requirement scanning, payment rejection/reconciliation, invoice issue/void, delivery close, preference persistence and verified navigation/focus changes. Tests exercise handled API failures, invalid credentials, expired/replayed invitations, MFA failure, fifth-user rejection, CSRF, administrative/session revocation and tenant isolation across the retained authentication and authorization suites.

Final passing outcome coverage: actions 40/40, forms 25/25, button labels 30/30, navigation 18/18, disclosure 1/1. All 76 field names were observed and 51 were directly changed; unchanged defaults and all input permutations are not separately certified. Seven UI paths were observed from DOM evidence; the other route/API patterns remain catalog entries with separate HTTP/repository tests, not invented browser-route passes. The collector does not independently count the twelve native-dialog patterns. Native-dialog workflow decisions are covered through their resulting actions; assistive-technology verification remains manual. The source inventory itself contains no PASS statuses.

Validation is reported separately in the receipt:

| Suite | Final result |
| --- | --- |
| Repository release gate | 805 passed, zero failed/skipped; source/build/IP/site checks pass |
| Browser | 40 passed, zero failed/skipped; all original authentication browser cases retained |
| Disposable PostgreSQL authentication | 18 passed |
| Disposable PostgreSQL UAT broker | 7 passed |
| Disposable PostgreSQL Operations | 16 passed |
| Hosted / real Google / approved external testers | BLOCKED, not run |

PostgreSQL tests use disposable local clusters and genuine restricted TLS logins. They do not certify the absent real hosted auth/broker credentials or complete a durable hosted Operations adapter. Browser tests use real local SQLite persistence and synthetic provider assertions; the HTTPS fixture converts intercepted same-origin redirects into fresh navigations because Playwright does not intercept the rest of a fulfilled redirect chain. HTTP integration tests independently check actual redirect responses.

The final coverage decision and axe totals are recorded from the completed browser artifact in the receipt. All 76 inventoried field names are observed, but input/default/validation permutations are not exhaustively certified. Native approval dialogs are exercised by workflow tests; their screen-reader behavior, reading order, 400% zoom, touch/speech input and axe incomplete findings still require human review. Zero automated axe violations is not a blanket WCAG conformance claim. Route counts are source patterns/API references; they are not a claim of browser verification for every HTTP method, identifier or administrative API-only capability.

Initial failed runs remain in the local diagnostic logs. They exposed the fixed editor focus/version issues, stale-CSRF sign-out defect, evidence-hook defect and worker timing race, plus corrected synthetic test setup/assertions. Final counts exclude failed diagnostic attempts. No cross-tenant authorization violation or unresolved critical dead control was found in the final passing journeys.

Evidence logs: `C:/Cdev/I-WAY/pkg/dist/b591-b600/verify-final.log`, `browser-certified.log`, `auth-postgres.log`, `broker-postgres.log`, `operations-postgres.log`. The receipt hashes them and records their paths.

Local decision: GO for the discovered action/form/navigation/button workflows when the coverage receipt has no executable-control gaps. Hosted decision: NO-GO / BLOCKED. Outstanding hosted blockers remain real canonical identity and tenant/fleet/employment evidence, explicit provisioning/privilege approval, genuine restricted runtime credentials, Preview configuration/entrypoint, durable Operations persistence, an approved external access route and successful hosted four-persona/negative E2E. No change in this batch grants access or closes those approval boundaries.
