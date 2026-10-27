# I-WAY B681–B690 — Four-step carrier load wizard

The supported local load-creation workflow is implemented. Final measured results and the exact committed candidate are recorded in `receipt.json` and `dist/b681-b690/post-commit-verification.json`. Hosted activation remains NO-GO. B691–B700 was not started.

This execution began on clean branch `work/b561-b580-external-uat` at `5871dc168ff6f26bf1244a027f63d4fa0d19d92b`. The requested `4d75051002f190b2178c6c88fea0272cfca507f5` is an older ancestor. Its subsequent implementation was preserved. The earlier `docs/security/b681-b700-*` artifacts describe a different historical readiness batch and remain unchanged.

The user story is: an authorized carrier opens Create load, completes four steps, reviews and confirms the terms, and sees one persisted draft load. The browser calls the existing Operations command endpoint. Tenant-scoped server drafts wrap the existing `load:create` domain command inside its transaction and idempotency contracts. Dispatch validation and human approval remain separate.

## Implementation and batch evidence

| Batch | Delivered behavior | Evidence |
| --- | --- | --- |
| B681 | Verified clean current baseline and preserved newer implementation | Git parent and changed-file manifest in receipt |
| B682 | One shared wizard is the normal Create load experience; obsolete single-page form removed | `ops.js`, four-step browser tests |
| B683 | Reference, customer/broker, optional customer portal, active dispatcher, cargo, weight and dimensions | Step-1 validation and existing assignment eligibility contracts |
| B684 | Two to twenty stops, pickup/delivery ordering, UTC appointments, windows, facilities and private notes | Browser invalid chronology/window tests; domain validation |
| B685 | Integer USD cents, bounded charges, factoring or customer billing, agreed terms and private notes | Amount boundary and final validation tests |
| B686 | Complete summary, section edit controls, explicit confirmation, financial total | Four responsive browser cases and screenshots |
| B687 | In-memory retention across application navigation; authorized server drafts survive reload | Navigation, save/recovery and legacy-draft tests |
| B688 | Keyboard progress controls, Back/Next, focus management and branded responsive layouts | Keyboard and axe evidence at 320/390/768/1440 px |
| B689 | Safe duplicate submission, lost-response retry, rejection recovery, role/tenant denial and atomic rollback | Browser, unit and disposable PostgreSQL tests |
| B690 | Regression, secret review, committed-source and artifact verification | Receipt and post-commit verification |

## Contract and recovery details

`load:create` accepts the same payload fields. New draft metadata `flowVersion: 2` distinguishes four steps (0–3) from legacy five-step drafts (0–4). Legacy requests retain their validation behavior; existing drafts reopen at step 1 with all fields retained. No hosted migration is needed for this JSON draft metadata.

Step advancement validates on the server. Final submission validates all load fields again and enforces agreed payment terms and billing for the new flow, even when a caller bypasses UI stages. Resource version checks, active same-tenant dispatcher checks, customer authorization, restricted-role RLS and the atomic load/shipment transaction remain enforced.

A busy guard suppresses overlapping submit events. On an uncertain network failure the retained submission version and command idempotency key are retried. A definite command validation rejection reopens editing. Failed refreshes after successful commands retain their command receipt. Tests distinguish committed-but-lost responses from rejected commands.

Draft customer and commercial data is never stored in localStorage, sessionStorage, IndexedDB, URLs or analytics. Unsaved inputs survive navigation within the application in memory; explicit Save draft and leave stores authorized data server-side. A browser reload before a successful server save can lose newer unsaved changes. Cancel editing discards unsaved memory and leaves previously saved drafts intact. Save/reload persistence is not an offline or crash-proof draft guarantee.

## Scope limits and remaining blockers

- **BLOCKED_CONTRACT — specialized equipment types.** The existing load contract supports weight, dimensions and required vehicle capacity. It has no equipment-type or specialized-requirement field. No unsupported field was invented. The review shows minimum capacity, and existing eligibility rejects undersized vehicles. Adding specialized type selection requires an approved domain model, vehicle compatibility rules, persistence and API contract before implementation.
- **BLOCKED — hosted certification.** No exclusive staging PostgreSQL target/management owner, approved invitation delivery owner or operational external-tester route has been established. Existing A01–A12 approvals and deployment-protection boundaries remain in force. No hosted tests executed in this batch.
- **NOT RUN — human accessibility.** Screen-reader usability and other human assistive-technology procedures remain pending. Axe and keyboard tests are local evidence, not complete WCAG conformance.
- **BLOCKED_REFERENCE — original Figma comparison.** The canonical file/version and screen exports remain unavailable. Screenshots were checked for layout and brand consistency; no Figma conformity percentage is claimed.

Local certification applies to the supported existing load contract. Specialized equipment selection remains explicitly unimplemented. Hosted and production certification remain NO-GO. B691–B700 requires a separate continuation after this scoped batch is accepted; it was not executed.

## Test evidence

| Suite | PASS | FAIL | Scope |
| --- | ---: | ---: | --- |
| Repository + verify | 917 | 0 | Source checks, site build/checks, IP scan, unit/integration/security tests |
| General Chromium | 115 | 0 | All 115 tests; frozen source |
| PostgreSQL-backed browser variants | 41 | 0 | Repeated lifecycle/responsive scenarios on PostgreSQL; frozen source |
| PostgreSQL 17.11 regression | 96 | 0 | 105 Node checks include nine orchestration parents |
| Wizard browser-to-PostgreSQL journey | 5 | 0 | Six Node checks include one parent; restricted login and restart persistence |
| General browser axe scans | 216 | 0 | PASS column is scans; FAIL column is violations |
| PostgreSQL browser axe scans | 46 | 0 | PASS column is scans; FAIL column is violations |
| Dedicated wizard PostgreSQL axe scans | 4 | 0 | Scans across all four steps |
| Configured-secret/format review | 1 | 0 | Bounded candidate scan; private values never printed |

The initial full browser attempt recorded 114 PASS and 1 FAIL. The failure was an incorrect assertion that another tenant’s carrier must lack its own Create load control. The test now verifies permitted own-workspace access and rejects foreign draft/dispatcher identifiers. Its focused rerun passed; the final full run above passed. The first run is retained as diagnostic evidence and is not the certified source snapshot. No authorization policy was weakened.

Counts are reported separately. PostgreSQL browser variants repeat application lifecycle scenarios from the general suite. Node parent orchestration tests are not extra leaf scenarios. No combined distinct-test total is claimed. All identities, documents and commercial values used in fixtures/screenshots are synthetic. Synthetic OAuth does not certify Google or hosted MFA.

Review screenshots at 390 and 1440 pixels were visually inspected. The private environment remained ignored and untracked. Secret checks are bounded exact comparisons against configured private values plus selected credential formats, not a universal historical secret audit. Artifact delivery verification produces an approval-required plan and performs no deployment.

## Exact changed files

- `apps/operations/load-wizard.js`
- `apps/operations/ops.css`
- `apps/operations/ops.js`
- `docs/certification/b681-b690-load-wizard/certification-report.md`
- `docs/certification/b681-b690-load-wizard/receipt.json`
- `docs/security/b591-mvp-inventory.json`
- `domain/operations-load-wizard.mjs`
- `tests/browser/b681-load-wizard.spec.mjs`
- `tests/browser/certification-permutations.spec.mjs`
- `tests/browser/load-wizard-recovery.spec.mjs`
- `tests/browser/load-wizard.spec.mjs`
- `tests/browser/mvp-actions.spec.mjs`
- `tests/browser/operations.spec.mjs`
- `tests/local/load-wizard-browser-postgres.mjs`
- `tests/local/next-gap-closure.postgres.mjs`
- `tests/operations-client.test.mjs`
- `tests/operations-load-wizard.test.mjs`
