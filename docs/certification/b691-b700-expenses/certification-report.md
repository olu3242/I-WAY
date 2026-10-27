# I-WAY B691–B700 — Driver expenses and reimbursements

The batch extends the existing expense implementation with durable drafts, driver corrections, needs-information review, filters, private audit history and explicit reimbursement status. The supported local reference-only workflow is the certification scope. Hosted UAT and production remain NO-GO. No B701–B740 implementation was started.

Starting SHA: `864b19980515a3b3ad74d83df39ac670c074d08c`. Branch: `work/b561-b580-external-uat`. The baseline worktree was clean. Its 16 committed-source hashes, 37 evidence hashes and accepted artifact hash were independently verified before editing. The exact ending SHA and clean-worktree proof are generated after local commit at `dist/b691-b700/post-commit-verification.json`.

## Delivered contracts and evidence

The user story is: the assigned driver saves or submits an expense, the owning company independently reviews it, the driver supplies requested corrections, and an approved immutable expense appears once in the appropriate approved pay statement. The UI uses POST `/api/ops/commands` and GET `/api/ops/state`. The existing command transaction, authorization, version and idempotency contracts continue through the restricted durable engine.

| Batch | Implementation | Verification |
| --- | --- | --- |
| B691 | Tenant, driver, employer and load identity; USD integer cents; existing seven categories; UTC timestamps and lifecycle | Domain, immutability and PostgreSQL tests |
| B692 | Direct submission retained; new server drafts; active receipt reservation and actor-bound replay prevention | Duplicate-event, lost-response, duplicate-receipt and durable restart tests |
| B693 | Original driver corrects draft or needs-information records; final records remain protected | Browser correction/cancel/filter and version-negative tests |
| B694 | Existing employing-company authority; approve, reject, needs-information with reasons; independent review and relationship hold | Role/tenant/employer denial and concurrent review tests |
| B695 | Versioned sources enter carrier-driver settlement or fleet driver pay; approval checks source totals, ownership and exclusive allocation | Financial integration, late-approval, reopening and restore tests |
| B696 | Opaque receipt references; no sensitive file upload, URL retrieval or storage activation | URL/path/forgery negative tests |
| B697 | Driver history, draft/correction, filters, review reasons and reimbursement visibility | 390/1440 browser journeys, screenshots and axe |
| B698 | Scoped carrier/fleet review queue, status/category/load/date/linkage filters and recent private audit | Positive review and unauthorized-content tests |
| B699 | Strict amounts, valid calendar timestamps, immutable records, stale/replay/concurrent review and atomic rollback | Domain, PostgreSQL, HTTP and recovery evidence |
| B700 | Preserved wizard regression; repository/browser/PostgreSQL/accessibility/performance/recovery; local commit and artifact verification | Receipt and post-commit verification |

The exact machine-readable contract is `contracts.json`. Drafts require complete valid fields; they are not partial form snapshots. Eligible corrections preserve ID, driver, employer, load, original currency and creation time. Rejected and withdrawn records are terminal; needs-information is the return-for-correction state. Existing submitted-only clients remain supported. Legacy records missing the new currency/creation metadata are not rewritten, and historical audit events are not fabricated.

Receipt reservation is per tenant, driver, load and normalized reference across draft, submitted, needs-information and approved states. It does not prove receipt authenticity or detect the same physical document entered under different codes or loads. The existing workflow requires human review; no new reimbursement eligibility, deduction, rate, cap policy or approval authority was invented.

Approved reimbursements remain immutable. Reopening an existing financial statement uses its existing owner-authorized, reasoned workflow; the expense itself is not un-approved. A late expense remains awaiting an approved statement until its owner explicitly reviews a revision. Fleet reimbursements must fit the existing approved source budget. No supplement, transfer, cutoff, out-of-pocket payment or automatic amendment policy was invented. Employment/assignment changes hold the expense for authorized reconciliation; no owner is reassigned automatically.

The expense activity view exposes only authorized expense IDs, action, actor UUID, time, version/status and reason. It shows the latest 1000 permitted events with a truncation notice. Full original before/after audit evidence remains append-only in storage. Approved totals and statement linkage are never displayed as money transferred. No payment provider was called.

## Confirmed defects and corrections

- Incomplete employer checks in central expense projection were aligned with the review/state boundary, including denial of carrier access to fleet-owned expense contents.
- Receipt reservation now includes drafts and needs-information records, preventing competing active claims during correction.
- Financial approval checks each reimbursement source, version, amount, load and original employer; another approved document cannot claim the same expense.
- Impossible calendar dates previously normalized into another day are rejected in expense input. The pre-fix direct probe is retained as diagnostic evidence.
- The mobile activity summary failed the target-size scan during development; its target is now at least 44 pixels high and the affected rerun passes.
- Test-only cleanup ordering, a broad label selector and the error-state helper expectation were corrected. Development failures remain in their logs; only final frozen-source runs certify the candidate.

## Final results

| Suite | PASS | FAIL | SKIPPED | Scope |
| --- | ---: | ---: | ---: | --- |
| Repository + verify | 929 | 0 | 0 | Includes unit, integration, security, syntax, inventory, build, IP and site checks |
| General Chromium | 119 | 0 | 0 | Frozen source, synthetic local identities |
| PostgreSQL browser variants | 41 | 0 | 0 | Overlaps general lifecycle/responsive scenarios |
| PostgreSQL 17.11 regression | 105 | 0 | 0 | 115 Node checks include 10 orchestration parents |
| Expense browser-to-PostgreSQL | 6 | 0 | 0 | 7 Node checks include one orchestration parent |
| Preserved wizard browser-to-PostgreSQL | 5 | 0 | 0 | 6 Node checks include one orchestration parent |
| General axe scans | 224 | 0 | 0 | PASS column counts scans; FAIL column counts violations |
| PostgreSQL browser axe scans | 46 | 0 | 0 | PASS column counts scans; FAIL column counts violations |
| Dedicated expense / wizard axe scans | 7 | 0 | 0 | Separate disposable PostgreSQL journeys |

Performance: dispatch p95 98.204 ms; workflow p95 98.820 ms; documents p95 119.098 ms; tenant_isolation p95 104.096 ms. All four baseline gates PASS. Expense projection measurement: 100 expenses, 20 projections, p95 18.407 ms (MEASURED; no expense SLO certification). General recovery: PASS, RTO 600.865 ms, observed RPO 707 ms in the deliberate post-snapshot-loss fixture. Hosted cases: 8 BLOCKED, zero executed. Human assistive-technology checks: NOT RUN.

Counts remain separate: PostgreSQL browser variants overlap general browser scenarios; Node parent orchestration checks are excluded from leaf totals. The copied accepted wizard browser journey writes only into this batch’s evidence directory, preserving all B681 evidence. Prior accepted source remains available in Git.

The four general performance scenarios use the existing unchanged `docs/operations/PERFORMANCE_BASELINE.json`. The additional 100-expense/20-projection measurement has no approved expense-specific SLO and is reported as MEASURED, not an SLO certification. Recovery timings are disposable local measurements; the general rehearsal deliberately omits one post-snapshot fixture load and revokes restored sessions. The expense-specific restore test retains its pre-snapshot approved reimbursement and audit without duplication. No hosted disaster-recovery claim is made.

## Blocked and unexecuted work

- Hosted UAT: eight prepared cases BLOCKED, zero executed. Exclusive staging ownership, restricted management/runtime configuration, actual canonical accounts and memberships, approved invitation delivery and protected individual tester access remain unresolved under the existing A01–A12 register.
- Sensitive receipt images/files: BLOCKED_POLICY until storage, access, retention and deletion contracts are approved. Receipt-code validation is not comprehensive PII detection; descriptions must exclude sensitive data.
- Physical receipt verification, cross-load physical-document deduplication, changed-employment reimbursement transfer, supplemental pay and cutoff exceptions: [TBC] owner rules. No automatic behavior was added.
- Payment verification: NOT RUN; no approved payment evidence or provider integration is used. The product reports payment as not verified.
- Human screen-reader, touch/speech, zoom/text-spacing and native-dialog accessibility: NOT RUN. Passing axe/keyboard checks do not establish complete WCAG conformance.
- Original Figma comparison: BLOCKED_REFERENCE. Screenshots demonstrate local rendering and brand usage; no Figma conformity percentage is claimed.
- Specialized load equipment types remain the prior BLOCKED_CONTRACT gap; this batch does not change that contract.

The scoped PRD trace is `requirements.json`. The baseline already classified FR-DRV-020 as IMPLEMENTED_LOCAL for basic submission; this batch expands its coverage. Whole-register counts remain 8 IMPLEMENTED_LOCAL, 58 PARTIAL, 4 MISSING and 2 BLOCKED_DECISION; the whole product was not recertified. Missing driver geofence/map, signed BOL delivery and dispatcher communications, platform financial monitoring and sensitive-data contracts remain identified there. Carrier settlement/accounting and sensitive document requirements remain partial.

Decisions: GO for the covered local reference-only expense workflow after final gates pass. Hosted and production: NO-GO. No push, merge, deployment, hosted migration, credential rotation, real provisioning, real invitation, billing or protection change occurred.

## Exact changed files

- `apps/operations/expenses.js`
- `apps/operations/ops.css`
- `docs/certification/b691-b700-expenses/certification-report.md`
- `docs/certification/b691-b700-expenses/contracts.json`
- `docs/certification/b691-b700-expenses/hosted-uat-matrix.json`
- `docs/certification/b691-b700-expenses/receipt.json`
- `docs/certification/b691-b700-expenses/requirements.json`
- `docs/security/b591-mvp-inventory.json`
- `domain/operations-expenses.mjs`
- `domain/operations-settlements.mjs`
- `scripts/certify-postgres17.mjs`
- `scripts/inventory-mvp-controls.mjs`
- `tests/browser/b691-expenses.spec.mjs`
- `tests/browser/expenses.spec.mjs`
- `tests/local/expenses-browser-postgres.mjs`
- `tests/local/expenses.postgres.mjs`
- `tests/operations-expense-lifecycle.test.mjs`
- `tests/operations-expense-recovery.test.mjs`
