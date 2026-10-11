# Batches 41–60 — operational hardening and release evidence

## Baseline reconciliation
Date: 2026-10-11 (America/Chicago). Branch work/wave0-reconciliation-20261011 was clean at 67d9a01. Prior implementation commits and independent 8eb7aa4 were preserved. Required B01–20, B21–40 and browser evidence were read. Re-executed baseline: 134 automated tests, 0 failed/skipped; 8 real Chromium tests, 0 failed/skipped; IP/site checks passed. Historical PASS/PARTIAL and hosted NO-GO claims were confirmed.

## Canonical public release target
The user selected http://localhost:4174/early-access.html. Its HTTP response exactly matched C:/Cdev/I-WAY/pkg/site/public/early-access.html and did not match the I-WAY-app copy. PUBLIC_RELEASE_TARGET.json pins the selected entry hash. npm run verify:public-target rejects a mismatched artifact. This check certifies entry-file identity only, not a deployment or complete public-site acceptance. No public source was replaced and no deployment was executed.

## Wave 5 implementation matrix
| Batch | Status | Executable evidence / remaining boundary |
|---|---|---|
| 41 | PASS (local) | Event-derived cycle/exception/utilization metrics, separated costs, immutable reported mileage, estimate comparison and recommendation adoption/delivery outcomes. Causal ROI remains unavailable. |
| 42 | PASS (local) | SQLite online WAL backup, private new destinations, trusted manifest digest, restore integrity and session revocation, actual recovery rehearsal. |
| 43 | PASS (local) | Generated correlation IDs, allowlisted structured HTTP events, storage health, scoped queue counts and actionable alert interface. External alert delivery is disabled. |
| 44 | PASS (local) | Independent-process dispatch/workflow/document/isolation workload; measured latency, throughput and CPU/RSS against fixed calibration-derived regression budgets. Not a hosted SLO. |
| 45 | PARTIAL | Automated WCAG-tagged scans, keyboard/focus/error/responsive remediation pass; manual screen-reader and incomplete contrast assessment remain open. |
| 46 | PASS (local) | Current load visibility and governance permission enforced on cached command replies; tenant, HIL, input, audit and provider-provenance regressions. |
| 47 | PASS (local) | Bounded provider-neutral document contract reuses parser, transactions, idempotency and human review; schema/provenance/failure/timeout checks. No external document provider. |
| 48 | PARTIAL | 12 real-engine deterministic offline cases and adversarial harness tests pass. No approved model ran; model quality/cost/latency remain BLOCKED or unavailable. |
| 49 | PASS (local) | Complete carrier/dispatcher/driver/fleet/customer browser workflows, stale-state recovery and aborted-response replay without duplicate mutation. |
| 50 | PARTIAL | Source/log/artifact-bound machine manifest validates; all executable local gates pass. Manual accessibility and approved-provider gates remain unresolved. |

## Wave 5 actual gate
npm run ops:certify ran all six gates and returned localExecutableGate=PASS, localDecision=PARTIAL, hostedDecision=NO-GO.
- Automated tests: 160 passed, 0 failed, 0 skipped; IP scan and 4-page site check PASS.
- Browser tests: 11 passed, 0 failed, 0 skipped; 54 axe scans, 0 violations at 320/390/1440 pixels. Conformance remains manual_review_required.
- Performance: dispatch p95 65.12 ms, 52.12 work/s; workflow p95 161.63 ms, 112.49 work/s; documents p95 147.94 ms, 111.55 work/s; tenant_isolation p95 63.61 ms, 235.98 work/s. Zero unexpected errors. Expected assignment conflicts and cross-tenant denials are reported separately.
- Recovery: observed RPO 281 ms, observed RTO 254.03 ms. The scenario deliberately commits one shipment after backup: 2 post-snapshot audit events are absent, as expected. Recovered audit prefix is exact, sessions are invalidated, and five advisory checkpoints resume. These are measured fixture timings, not operational guarantees.
- Evaluation: 12/12 deterministic cases passed; synthetic exact-label/policy compliance 1/1; local scenario p95 25.50 ms. Model calls 0 and cost null.

See EVIDENCE_WAVE5.json for compact measured results, CERTIFICATION_WAVE5.json for the immutable checkpoint manifest, BROWSER_EVIDENCE.md for browser limits, and RECOVERY.md / PERFORMANCE.md for procedures and thresholds. Current raw artifacts regenerate in ignored dist/operations-evidence. npm run ops:certify:validate rejects changed source, changed logs, missing/altered measurement artifacts, missing counts and attempts to promote blocked hosted gates. Hashes establish local artifact integrity, not independently signed external attestation.

## Safety and persistence
All operational scenarios use disposable synthetic tenants and local adapters. No .env.local values were read, printed or changed. No hosted database connection, migration deployment, permission change, provider activation, external message, registration certification or production release ran. The restored fixture's session records are intentionally revoked; source databases and existing destinations are never overwritten.

New evidence is immutable at the database boundary. Runtime transactions, leases/fences, current principal checks and human approval remain authoritative. Actuals are labeled user-reported where applicable; distance variance and recommendation adoption do not imply measured savings or causation.

## Reproduce
- npm run verify
- npm run test:browser
- npm run ops:benchmark
- npm run ops:recovery:verify
- npm run ops:evaluate
- npm run verify:public-target
- npm run ops:certify
- npm run ops:certify:validate

The only new dependency is pinned development-only @axe-core/playwright; existing Playwright and native Node/SQLite/domain engines are reused.

## Wave 6
B51–60 implementation and evidence will be recorded after the verified Wave 5 checkpoint.

## Unchanged parking lot
Restricted-role PostgreSQL authentication 28P01; approved IWAY_CONSENT_VERSION; exposed owner password and service-role key rotation; hosted identity/persistence certification; approved AI provider; production deployment authorization. No gate is bypassed.
