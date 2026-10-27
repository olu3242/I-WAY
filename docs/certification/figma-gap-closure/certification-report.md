# I-WAY — Figma gap closure and local certification

Covered local workflows: GO. Full four-application conformity: NO-GO / incomplete. Hosted certification and production readiness: NO-GO.

This is an implementation and verified local regression milestone. It does not complete every P0/P1 requirement. Partial and missing repository work is listed explicitly rather than relabeled as an approval blocker.

Starting SHA: 4a1c39b66fd0db383ef430074f9747c359512a2a. Branch: work/b561-b580-external-uat. Starting worktree: clean. Ending SHA: the local commit containing this report; the literal ending SHA, clean-worktree proof and artifact checksum are recorded in dist/figma-gap-closure/post-commit-verification.json. No push, merge, deployment, hosted migration, real identity provisioning, invitation, credential rotation, protection or billing change occurred.

## Implemented modules and fixes

- Driver status queue: bounded IndexedDB storage, static offline recovery, reload/reconnect, stable replay keys, fresh session/CSRF and current assignment/eligibility checks. Lost-response and concurrent restart replay produce one persisted effect. No documents, signatures, tokens or customer/location data are queued.
- Financial foundation: weekly source-backed settlement calculations, once-per-week deductions, target-capped derived escrow, stale-source rejection, immutable approvals, audited reopening/adjustments and fleet disputes. Fleet-owned per-load driver pay checks live employment and approved settlement budget. Driver earnings exclude carrier commercial fields and carrier-to-fleet statements.
- Assignment and search: driver rejection with reason and replay-safe release; visible-load search and active/completed lists.
- Maintenance: carrier intervals, monotonic odometer reports, driver/owner service history, owner review and due warnings. A fleet cannot clear a carrier out-of-service hold; fleet-private service notes are absent from carrier projections.
- Brand/accessibility: unchanged logo with white chip, locally bundled Inter/license, approved colors/radii, one orange primary action per rendered view, driver primary targets and keyboard queue cancellation focus.
- Confirmed remediation: financial submit state now disables the submit control after adding deduction controls; duplicate submission is explicitly tested. Client/package fixtures include the real added assets. Keyboard browser tests synchronize with enabled controls. Browser evidence binds source hashes at start and end and rejects source changes during execution.

See [implemented contracts](implementation-contracts.md) for calculation, privacy, ownership and recovery limits.

## Actual test results

| Suite | PASS | FAIL | BLOCKED / NOT RUN | Scope |
|---|---:|---:|---|---|
| Repository npm run verify | 893 | 0 | 0 skipped | Syntax, repository regression, public build/IP/structure gates |
| General Chromium browser | 97 | 0 | 0 skipped | Disposable SQLite/HTTP and synthetic identity providers |
| PostgreSQL Chromium variants | 41 | 0 | 0 skipped | Restricted disposable PostgreSQL; overlaps general browser cases |
| PostgreSQL 17.11 | 86 leaf scenarios | 0 | 0 skipped | 94 Node checks include eight orchestration parents |
| Performance | 4 scenarios | 0 | No hosted SLO/capacity claim | Unchanged checked-in regression budgets |
| Recovery | 1 rehearsal | 0 | Hosted disaster recovery not run | Backup/restore, audit preservation, session revocation and worker resumption |
| Hosted E2E | 0 | 0 | 92 BLOCKED | Zero hosted executions |
| Human accessibility | 0 | 0 | 56 NOT RUN | 48 existing and eight added scripts |

Counts are separate and must not be summed as unique assertions. Exploratory failures are retained in local logs; only the frozen-source final runs above are certification evidence. Synthetic Google/password/MFA results do not certify real hosted authentication.

General axe scans: 176, violations 0. PostgreSQL browser axe scans: 46, violations 0. Manual review remains required; these scans are not complete WCAG conformance.

Performance p95 milliseconds: dispatch 78.26; workflow 203.19; documents 115.16; tenant_isolation 59.09. Recovery observed RTO 402.78 ms and RPO 595.00 ms in the deliberate local snapshot-loss rehearsal. Dependency registry audit reports zero known vulnerabilities across 19 dependencies; it is not a guarantee that vulnerabilities do not exist.

## Coverage and conformity

Implemented interaction outcomes: 55/55 actions; 30/30 forms; 39/39 button labels; 21/21 navigation entries. No inventoried executable control lacks local outcome evidence.

The source inventory also contains 55 route patterns and 102 field names. Only 78 fields have recorded interaction evidence. Route discovery is not HTTP-method/resource coverage, and form/action coverage does not certify all input permutations.

New application API contract coverage: 15/15 (100%) for the explicitly enumerated thirteen command actions plus offline context/replay. Overall repository/provider API integration percentage is not certified. See dist/figma-gap-closure/api-contract-evidence.json.

Four personas execute persisted/keyboard workflows at 320, 375, 390, 768, 1024 and 1440 pixels. 66 screenshot artifacts are recorded in dist/figma-gap-closure/screenshots.json. Selected 320-pixel Platform, Carrier and Driver screenshots were visually inspected; that inspection does not substitute for all-screen comparison.

Figma functionality conformity percentage: NOT CERTIFIED. Visual conformity percentage: BLOCKED_REFERENCE, no percentage calculated. The canonical original Make file/version and original exported screen images are unavailable. Checked-in prototype flows and Brand Kit tokens are used; legacy dark/amber styling is superseded.

Strict whole-PRD-row review: 6/72 locally implemented rows (8.33%); 57 partial, 7 missing, 2 blocked by a sensitive/native decision. Compound partial rows receive no whole-row credit. This conservative PRD ratio is not a Figma similarity or feature-completion percentage. See the complete [gap register](gap-register.md) and [machine-readable trace](requirements.json).

## Remaining implementation and blockers

| Type | Remaining item | Exact next action |
|---|---|---|
| Repository work, P0/P1 | Full load wizard/directories and status-aware corrections; fine-grained arrival/loading; driver expenses; full onboarding/profile/typed document flows | Continue those modules against their individual PRD rows, with human/tenant/financial gates retained. They are not marked externally blocked solely because code is absent. |
| Repository work, P0/P1 | Remaining fleet pay models, vehicle-sourced terms, pay-week navigation/moves, financial summaries, statement PDFs and full escrow ledger | Implement/review missing contracts and negative tests; obtain OQ-02/OQ-04/OQ-05/OQ-06 decisions where relevant. |
| Repository work, P0/P1 | Full platform tenant/staff/case/configuration workflows and reason-bound support/audit grants | Implement a reviewed management-plane contract; do not grant implicit operational cross-tenant authority. |
| BLOCKED_DECISION | Native/background location, geofencing and secure offline photos/signatures | Resolve ADR-002/OQ-11 and sensitive evidence storage/retention OQ-08. Keep collection disabled until reviewed. |
| BLOCKED_REFERENCE | Original screen-by-screen visual comparison | Supply the original Logistics App Design Figma link/version and exported screens. |
| BLOCKED_OWNER_TARGET | No exclusively approved I-WAY staging database, management owner or invitation delivery owner | Owner designates target and owners; retarget/review runtime pins, SQL packages and A03–A09 before any activation. Public early-access and Velocity databases are excluded. |
| BLOCKED_APPROVAL | Environment, migrations, real identities/MFA, invitation delivery, protected Preview and external access | Resolve exact A01–A12 actions as applicable; no inferred approval and no deployment-protection bypass. |
| NOT RUN | Human assistive-technology, native-dialog, zoom/text-spacing, touch/speech and real-device validation | Execute the 56 prepared scripts with recorded reviewer/device/browser/AT versions and defect evidence. |

The legacy local environment is not an approved staging runtime: 2/13 required Preview names are present locally. Current effective hosted values/presence were not re-inspected. No private values appear in the checklist. Previously pasted credentials require credential-owner review before activation; they were neither used for hosted access nor rotated here.

## Approvals, integrity and handoff

See [approval boundary](approval-boundary.md) and the preserved A01–A12 register. Historical database target text is superseded by the owner exclusion; it must not be executed as written. Existing stored principals receive no automatic new permissions.

The candidate secret scan reports zero configured-private-value matches and selected private-format matches, with .env.local ignored and untracked. This is a bounded candidate scan, not a historical/universal secret guarantee. The local packaging allowlist includes the added runtime code/font/license; docs, reference, site, tests and .env files remain outside the staging artifact.

Post-commit verification builds the exact committed artifact twice, verifies checksums/isolation/private-path exclusions and probes the unconfigured adapter fail-closed. Its result and literal SHA are in dist/figma-gap-closure/post-commit-verification.json. No artifact is uploaded or deployed.

Local covered workflows: GO. Full four-application MVP/Figma certification: NO-GO. Hosted staging certification: NO-GO. Production readiness: NO-GO.

## Exact changed files

- apps/operations/Inter-LICENSE.txt
- apps/operations/InterVariable.woff2
- apps/operations/driver-offline.mjs
- apps/operations/driver-sw.js
- apps/operations/extended.js
- apps/operations/financial.js
- apps/operations/index.html
- apps/operations/maintenance.js
- apps/operations/offline.html
- apps/operations/ops.css
- apps/operations/ops.js
- docs/certification/figma-gap-closure/approval-boundary.md
- docs/certification/figma-gap-closure/certification-report.md
- docs/certification/figma-gap-closure/gap-register.md
- docs/certification/figma-gap-closure/implementation-contracts.md
- docs/certification/figma-gap-closure/receipt.json
- docs/certification/figma-gap-closure/requirements.json
- docs/feature-completion/fcc-03-driver-offline-contract.md
- docs/security/b591-mvp-inventory.json
- domain/authorization.mjs
- domain/driver-offline-replay.mjs
- domain/operations-features.mjs
- domain/operations-lifecycle.mjs
- domain/operations-maintenance.mjs
- domain/operations-projection.mjs
- domain/operations-settlements.mjs
- domain/operations.mjs
- scripts/certify-postgres17.mjs
- scripts/inventory-mvp-controls.mjs
- scripts/package-uat-staging.mjs
- scripts/report-figma-certification.mjs
- scripts/review-candidate-secrets.mjs
- scripts/trace-figma-requirements.mjs
- server/operations-app.mjs
- server/operations-durable-uat.mjs
- server/operations-offline.mjs
- server/operations-store.mjs
- server/operations-uat-application.mjs
- tests/browser/brand-tokens.spec.mjs
- tests/browser/driver-offline.spec.mjs
- tests/browser/evidence-reporter.mjs
- tests/browser/load-search-rejection.spec.mjs
- tests/browser/maintenance.spec.mjs
- tests/browser/responsive-personas.spec.mjs
- tests/browser/settlements.spec.mjs
- tests/driver-assignment-response.test.mjs
- tests/driver-offline-integration.test.mjs
- tests/helpers/settlement-fixture.mjs
- tests/local/figma-finance-offline.postgres.mjs
- tests/operations-client.test.mjs
- tests/operations-maintenance.test.mjs
- tests/operations-settlements.test.mjs
- tests/uat-staging-package.test.mjs
