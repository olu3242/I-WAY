# Batches 21–40 — implementation and certification evidence

## Reconciled baseline
Expected branch work/wave0-reconciliation-20261011 was clean at bec1ea9. Commits 19952ca and bec1ea9 contain the actual local implementation. Before edits, npm run verify independently passed 73 tests (0 failed, 0 skipped), IP scan and all four public-page checks. Prior B01 PASS / B02–20 PARTIAL claims were accurate; hosted release remains NO-GO.

Foundational convergence fixed two issues found by independent review: mutation and idempotent replay responses now redact commercial fields for drivers/fleets and check current ownership; user/fleet/invoice listings respect explicit permissions rather than carrier role alone. The customer role uses a persisted customerId relationship, never company-name matching or client tenant claims. Documents, financial records and notifications retain separate permission checks.

Real Chromium testing is now reproducible with npm run test:browser. It uses isolated SQLite fixtures and loopback HTTP, not .env.local or Supabase. See BROWSER_EVIDENCE.md for exact browser runs. This closes the previous unavailable-browser gap locally; it does not establish hosted identity/persistence or model-provider readiness.

## Group A implementation
- B21: bounded 32 KiB plain-text/JSON ingestion, actual deterministic classification/extraction, confidence and provenance. Human review is mandatory; PDF/image OCR and model extraction are not configured.
- B22: shipment-linked BOL fields, content hashes, immutable version lineage and scoped content retrieval. Customers can retrieve only the latest validated BOL for their own shipments.
- B23: driver/assigned-dispatcher recipient acknowledgment, evidence reference and immutable completion event. No raw signature or GPS fields are accepted. Database triggers prohibit evidence modification/deletion.
- B24: missing, mismatched, pending or rejected document exceptions; escalation and audited resolution following corrected, reviewed evidence.
- B25: document-backed invoice generation/issue, exact integer cents, existing human finance approval and duplicate prevention. Legacy preparatory invoice records are retained; issuance always rechecks latest document/POD readiness.
- B26: reported payment evidence, matching/discrepancy correction, separate human reconciliation, balance protection and audited voiding. Evidence is labeled user_reported/local_fixture; there is no bank verification or money movement.
- B27: protected customer portal, shipment milestones, validated document access and issued invoice status. Own customer relationship and tenant are enforced at API/domain/persistence boundaries.
- B28: event-triggered local notification outbox, static templates, current-recipient authorization, preferences, suppression, idempotent records, bounded retry/backoff and dead letters. No external messages are sent.
- B29: recorded on-time delivery, cycle duration, exception rate, current utilization and invoice readiness with evidence IDs and denominators; absent measurements return null.
- B30: integrated local document/delivery/billing/customer tests plus browser journey. Hosted dependencies remain BLOCKED.

Group A full quality gate: **98 passed, 0 failed, 0 skipped**, IP scan PASS, site check PASS (4 pages). Final response authorization hardening also passed its 25 relevant domain tests. Browser results are maintained separately in BROWSER_EVIDENCE.md.

## Runtime and boundaries
New features compose through Operations.extensions and state-view functions. Existing load, finance, eligibility and transaction engines are reused. Operational assets remain in apps/operations, outside public site/. All fixtures are explicitly illustrative and disposable; no configured secrets or production data are used.

No hosted migration, RLS/permission change, credential reset, deployment, external financial action, live message or model-provider call is part of this work.

## Parking lot
Restricted Supabase authentication 28P01; approved IWAY_CONSENT_VERSION; rotation of exposed owner password and service-role key; hosted registration certification; production deployment approval; approved AI-provider integration. None is bypassed.

## Group B implementation and final gate

- B31: tenant- and assignment-scoped control tower for shipments, assigned people/equipment, exceptions, approvals and actionable records.
- B32: persisted arrival estimates from supplied distance, speed and handling time; schedule constraints, explicit assumptions and low confidence. No live traffic, road routing or hours-of-service claims.
- B33: explainable risk rules for overdue milestones, estimated delay, stale estimates, unavailable capacity and open exceptions. Scores express rule priority, never a probability.
- B34: current eligibility-based capacity matching, a separate carrier reviewer and an explicit human application command. Current reviewer authority, load/asset versions, expiry and eligibility are rechecked before assignment.
- B35: five fixed advisory roles (dispatch, tracking, documents, exceptions and finance), each with explicit tool and permission bounds. Dispatcher plans omit finance. Decisions are deterministic; provider/model provenance is preserved.
- B36: persisted checkpoints, bounded retries/backoff, dead letters, leases/fences, cancellation, reauthorization and duplicate protection. Async adapters run outside database write transactions.
- B37: mapping, telematics, communications, accounting and logistics contracts with bounded schemas and local-only adapters. Provider/version/source are bound to the server-approved lease; forged output is rejected.
- B38: carrier policy pause/resume and tool restrictions, human reasons, immutable decision evidence, current authority checks and prohibited autonomous dispatch/financial actions.
- B39: separate user-recorded costs and estimates; cost per measured load, exception cost, cost per estimated mile and explicit missing-data counts. Route efficiency, measured recommendation impact and savings remain unmeasured. This batch is PARTIAL.
- B40: integrated browser/API journey, negative authorization, adversarial fields, concurrency, replay and process recovery pass for the implemented local scope. Overall release readiness remains PARTIAL.

Final repository gate: **134 passed, 0 failed, 0 skipped** via `npm run verify`; IP scan PASS and site structure PASS (4 pages). Real Chromium gate: **8 passed, 0 failed, 0 skipped**, 20.6 seconds. These are separate suites, not 142 hosted tests.

Independent review found and repaired three concrete gaps before this gate:
1. General workspace audit state now returns metadata only, never historical before/after payloads. Stored evidence remains append-only. No in-app detailed audit-forensics export is claimed.
2. Previously approved exception workflows recheck the persisted reviewer's activation, tenant, carrier role and current approval permission. Withdrawn authority leaves the exception open and requires renewed review.
3. Connector completion verifies provider/version/source against the server-approved adapter bound at claim time.

An initial governance policy now retains its required human reason in protected policy and audit evidence. Historical route/risk/decision/job displays show time, shipment version and run where applicable, and flag changed shipment versions.

### Approved local role policy

The user explicitly approved the following source defaults during this execution:
- Carrier: intelligence:view, intelligence:analyze, capacity:recommend, capacity:approve, capacity:apply, cost:manage, orchestration:manage, connector:request, governance:manage.
- Assigned dispatcher: intelligence:view, intelligence:analyze, capacity:recommend, capacity:apply, orchestration:manage, connector:request.

Application still requires separate carrier approval and tenant/ownership checks. The change affects new local account defaults only. Existing stored principals and hosted permissions were not changed; driver/fleet/customer/automation grants are unchanged from Group A.

## Current certification matrix, B01–40

“Local gate” covers the executable behavior described here, using isolated illustrative records and local adapters. “Overall” includes the remaining full certification gates inherited from B01–20. Local PASS does not certify Supabase, production identity, model inference or live integrations.

| Batch | Local gate | Overall | Evidence or remaining acceptance gap |
|---|---|---|---|
| 01 | PASS | PASS | Baseline source, branch, commits and 73-test gate reconciled |
| 02 | PASS | PARTIAL | Role/permission/tenant/relationship regressions; hosted identity/persistence pending |
| 03 | PASS | PASS | Protected shell, real Chromium, keyboard/focus and 390/1440 visual evidence |
| 04 | PASS | PARTIAL | Carrier API/UI workflow; hosted verification pending |
| 05 | PASS | PARTIAL | Assigned dispatcher workflow and denial/concurrency checks; hosted pending |
| 06 | PASS | PARTIAL | Driver mobile execution and commercial-field isolation; hosted pending |
| 07 | PASS | PARTIAL | Fleet mobile visibility and employment/ownership checks; hosted pending |
| 08 | PASS | PARTIAL | Durable lifecycle, versions, replay and reopened storage; hosted persistence pending |
| 09 | PASS | PARTIAL | Eligibility, independent approval and unique assignments; hosted pending |
| 10 | PASS | PARTIAL | Local Wave 1 API and browser gates closed; hosted gate pending |
| 11 | PASS | PARTIAL | Atomic load/shipment lifecycle; hosted integration pending |
| 12 | PASS | PARTIAL | Driver availability, compliance, approval and busy checks; hosted pending |
| 13 | PASS | PARTIAL | Equipment ownership, capacity, maintenance and approval; hosted pending |
| 14 | PASS | PARTIAL | Real UI stop execution, acknowledgment and delivery; hosted pending |
| 15 | PASS | PARTIAL | Recorded tracking and exception holds; no live tracking integration |
| 16 | PASS | PARTIAL | Concurrent workers, bounded retries and process recovery; hosted distribution pending |
| 17 | PASS | PARTIAL | Human separation, expiry, replay and current authority; hosted identity pending |
| 18 | PASS (rules) | PARTIAL | Explainable deterministic advice; approved model integration blocked |
| 19 | PASS | PARTIAL | Exact-cent invoice lifecycle and reported-payment reconciliation; no bank/settlement integration |
| 20 | PASS (local journey) | PARTIAL | Browser/API journey closed; model and hosted certification pending |
| 21 | PASS | PASS (local scope) | Bounded text/JSON classification/extraction and review; OCR/model inference not configured |
| 22 | PASS | PASS (local scope) | BOL versions, validation, immutable content and controlled access |
| 23 | PASS | PASS (local scope) | Authorized recipient acknowledgment and immutable evidence events |
| 24 | PASS | PASS (local scope) | Document exceptions, escalation and reviewed resolution |
| 25 | PASS | PASS (local scope) | Document-backed invoice generation, approval and issue |
| 26 | PASS | PASS (local scope) | Reported references, discrepancies, matching and human reconciliation |
| 27 | PASS | PASS (local scope) | Customer portal, persisted ownership and protected documents/invoices |
| 28 | PASS | PASS (local scope) | Local outbox, preferences, suppression, retry and dead letters |
| 29 | PASS | PASS (local scope) | Event-derived KPIs with denominators and missing-data disclosure |
| 30 | PASS | PASS (local scope) | Integrated documents-to-customer browser/API journey |
| 31 | PASS | PASS (local scope) | Scoped tower, assigned resources and actionable evidence |
| 32 | PASS | PASS (local scope) | Deterministic estimated arrival and constraint checks |
| 33 | PASS | PASS (local scope) | Risk rules, evidence, confidence and escalation |
| 34 | PASS | PASS (local scope) | Eligible recommendations, independent approval, human application |
| 35 | PASS | PASS (local scope) | Fixed advisory roles, bounded tools and durable decisions |
| 36 | PASS | PASS (local scope) | Leases/fencing, checkpoint recovery and graceful lifecycle |
| 37 | PASS | PASS (local scope) | Five validated local adapter contracts; no live integration certification |
| 38 | PASS | PASS (local scope) | Governance policy, approval authority, provenance and audit |
| 39 | PARTIAL | PARTIAL | Cost evidence works; measured route efficiency/impact baseline absent |
| 40 | PASS (implemented journey) | PARTIAL | Local regression/browser/recovery gates pass; B39 measurements and hosted release remain open |

## Evidence and changed areas

- `domain/operations-documents.mjs`, `operations-business.mjs`, `operations-portal.mjs`: Group A document, billing, notification, analytics and customer behavior.
- `domain/operations-intelligence.mjs`, `operations-runtime.mjs`, `operations-connectors.mjs`: Group B advisory analysis, capacity approval, durable runtime and local adapter contracts.
- `domain/authorization.mjs`, `operations.mjs`, `operations-projection.mjs`, `operations-automation.mjs`, `operations-features.mjs`: shared current-authority enforcement and feature composition.
- `server/operations-store.mjs`, `operations-app.mjs`, `operations-auth.mjs` and `scripts/operations-start.mjs`: persisted constraints, protected routes and scheduler lifecycle.
- `apps/operations/`: document/billing/customer UI plus control tower, analysis, capacity, runtime, adapters, governance and costs. Public `site/` files were not changed by this execution.
- `tests/operations-*.test.mjs`, `tests/browser/`, `playwright.config.mjs`: domain/API, concurrent-process, recovery and real-browser evidence. Playwright is the only added development dependency; no new runtime dependency.

Persistence evidence includes independent processes competing for assignment, human approval, payment reconciliation and worker leases. Exactly one eligible writer commits. Interrupted transactions roll back; abandoned leases resume with a new fence; stale workers cannot commit. Reopening storage preserves documents, ePOD, invoices and workflow decisions. The actual `ops:start` child process completed all five scheduled checkpoints against a disposable database. Portable lifecycle tests prove HTTP/scheduling stop, in-flight completion, then SQLite close; they do not claim Windows child termination invokes graceful signal handlers.

Browser accessibility evidence covers names/labels, landmarks, keyboard skip link, visible focus, persona navigation, no page overflow and visually reviewed 390/1440 layouts. No JavaScript exceptions were observed in tested journeys. This is not complete WCAG or screen-reader certification.

## Checkpoints and release decision

Group A checkpoint: `99384f3` (98-test gate, 7 browser tests). Group B checkpoint is the commit containing this final report (134-test gate, 8 browser tests). Branch: `work/wave0-reconciliation-20261011`.

An independently added commit `8eb7aa4` changes only `vercel.json`; it was preserved. This execution did not push or deploy. The commit title is not evidence that a deployment was verified.

Local decision: **PARTIAL**, with **GO for the tested local workflows**. B39's unmeasured values and lack of full accessibility/production operational certification are explicit limits. Hosted decision: **NO-GO**. Every live hosted integration remains BLOCKED; parked security and consent gates remain unchanged.

## Next dependency-ready Batches 41–50

These are proposed local follow-on scope, not executed or certified here.

41. Specify and approve the evidence model/baseline for route efficiency and recommendation impact; keep missing values unmeasured.
42. Add validated planned/actual operational evidence entry and traceable comparisons using that approved model.
43. Add local backup/restore tooling and corruption/restore rehearsal with disposable stores.
44. Add worker health, queue age and sanitized operational diagnostics.
45. Benchmark bounded large-tenant queries and queues; improve indexes/pagination from measured results.
46. Expand full keyboard, screen-reader and error-recovery browser coverage across new panels.
47. Add an explicitly authorized, permission-scoped audit-detail review/export path without restoring the workspace payload leak.
48. Extend local document format adapters with adversarial file and parser-bound tests; keep OCR/provider provenance honest.
49. Build offline provider contract/evaluation fixtures for future approved model and external adapter integrations.
50. Run a consolidated local release-candidate gate, restore drill and documented acceptance review.

Production identity, approved hosted schema/RLS, distributed execution, live providers, exposed-secret rotation, restricted PostgreSQL credentials, consent, hosted certification and deployment require their separate approvals and verified dependencies.
