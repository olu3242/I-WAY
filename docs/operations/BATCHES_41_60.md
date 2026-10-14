# Batches 41–60 — operational hardening and release evidence

## Baseline reconciliation
Date: 2026-10-11 (America/Chicago). Branch work/wave0-reconciliation-20261011 was clean at 67d9a01. Prior implementation commits and independent 8eb7aa4 were preserved. Required B01–20, B21–40 and browser evidence were read. Re-executed baseline: 134 automated tests, 0 failed/skipped; 8 real Chromium tests, 0 failed/skipped; IP/site checks passed. Historical PASS/PARTIAL and hosted NO-GO claims were confirmed.

## Canonical public release target
The user selected http://localhost:4174/early-access.html. Its HTTP response exactly matched C:/Cdev/I-WAY/pkg/site/public/early-access.html and did not match the I-WAY-app copy. PUBLIC_RELEASE_TARGET.json pins the selected entry hash. npm run verify:public-target rejects a mismatched artifact. This check certifies entry-file identity only, not a deployment or complete public-site acceptance. No public source was replaced and no deployment was executed.

## Wave 5 implementation matrix
| Batch | Status | Executable evidence / remaining boundary |
|---|---|---|
| 41 | PARTIAL | Event-derived cycle/exception/utilization metrics, separated costs, immutable reported mileage, estimate comparison and recommendation adoption/delivery outcomes. Causal ROI remains unavailable. |
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

## Wave 6 implementation matrix
| Batch | Status | Verified implementation / remaining boundary |
|---|---|---|
| 51 | PARTIAL | Idle/absolute expiry, persisted authority fingerprints, audited revocation, bounded role changes, real RS256/ES256 fixture signatures and MFA assurance. No hosted identity provider or production HTTP authentication integration. |
| 52 | PARTIAL | Restricted operations-only configuration, verified-client checks, parameterized async transaction contracts, offline private-schema migration with forced RLS. Recording-pool/static tests pass; PostgreSQL execution, async engine/auth parity and hosted isolation are BLOCKED. |
| 53 | PASS (local) | Atomic claims, bounded persisted heartbeats, current authority/policy checks, fencing, retries, restart and independent-process race tests. Multi-host/hosted runtime remains unverified. |
| 54 | PASS (local contracts) | Tenant-bound HMAC inbox, age window, deduplication, durable outbox, retries, circuit cooldown/half-open probe, dead letter, stale completion and current-grant checks. No real transport or delivery activated. |
| 55 | PASS (local contracts) | Versioned shipment/driver/vehicle/milestone/document/delivery reports with relationship/hash checks and provenance. Reports remain unverified human-review evidence and cannot mutate source lifecycle. |
| 56 | PARTIAL | Minimized provider contexts, strict output/tool policy, immutable advice, fallback, provenance and evaluation hooks pass. Approved model execution is BLOCKED. |
| 57 | PARTIAL | Names/presence-only inventory, sanitized configuration/security classification and rotation/incident procedures. No actual credential rotation or authentication verification. |
| 58 | PARTIAL | Independent retention approval and preview, immutable audit metadata exports with private reason, own-profile export and approved-registry consent enforcement. Registry stays empty; legal approval and retention execution are not enabled. |
| 59 | BLOCKED | Seven explicit scenario/receipt contracts and non-executing readiness artifact prepared. No hosted runner/transport is activated; no deployment journey was executed. |
| 60 | PARTIAL | Ten independent evidence-derived release gates, stale/tampered evidence rejection, canonical public entry gate, local PARTIAL and hosted NO-GO. Production deployment/rollback remain blocked. |

### Final evidence
The final npm run ops:certify completed every local gate against a stable source fingerprint. npm run ops:release:check, ops:release:validate and ops:certify:validate passed. npm run ops:hosted:plan returned BLOCKED, executed=false, seven scenarios.

- Automated tests: **207 passed, 0 failed, 0 skipped**; IP scan and site checks PASS.
- Chromium: **11 passed, 0 failed, 0 skipped**, 52.85 seconds; **54 axe scans, 0 violations**, 320/390/1440 px. Manual WCAG/assistive-technology review remains pending.
- Four independent processes, six rounds: dispatch p95 **85.95 ms / 44.90 work/s**; workflow **116.17 ms / 139.37 work/s**; documents **91.87 ms / 103.13 work/s**; tenant isolation **38.33 ms / 157.89 work/s**. Zero unexpected errors; expected conflicts and denials are separate. Fixed calibration budgets passed without relaxing thresholds.
- Recovery: observed **RPO 406 ms**, **RTO 361.56 ms**, 172032-byte backup; exact recovered audit prefix, session and security-metadata revocation, five resumed advisory checkpoints. One deliberately post-snapshot shipment/two audit events are absent. Source is preserved. These are fixture measurements, not hosted recovery guarantees.
- Offline evaluation: **12/12** deterministic cases; synthetic exact-label and policy agreement **1.0**, local scenario p95 **33.42 ms**. **0 model calls**, cost and model quality unavailable.
- Live canonical page recheck: HTTP **200** from http://localhost:4174/early-access.html; bytes match the pinned C:/Cdev/I-WAY/pkg/site/public/early-access.html hash. No deployment occurred.

CERTIFICATION_WAVE6.json is the final source/log/artifact-bound local manifest; EVIDENCE_WAVE6.json preserves measurements; RELEASE_WAVE6.json preserves independent decisions; HOSTED_READINESS_WAVE6.json preserves the unexecuted scenarios. Raw logs and full current artifacts regenerate under ignored dist/operations-evidence. Wave 5 historical snapshots remain intact.

### Security review and limits
Account managers cannot recreate withdrawn authority through new account grants or widen dispatcher relationships through carrier promotion. Federated identity bindings cannot grant a controlled subject access to a more privileged target. Current document/finance/load/governance permissions are rechecked on stored command replies. Session revocation cascades metadata; recovery preserves the source sessions while revoking restored ones. Audit, delivery, measurement, consent, provider and integration evidence have immutable local storage controls.

B52 tests use a recording pool and static migration assertions. Docker CLI was present but its engine was unreachable; no local PostgreSQL server was installed or started. The adapter is explicitly not wired into the synchronous operations engine. Offline SQL is unapplied and does not create credentials or grant runtime access. This is a substantive remaining implementation/certification gap.

Public deployment stays pinned to the user's port-4174 artifact in the separate pkg repository. I-WAY-app's differing public copy is not the authorized release target. The entry fingerprint does not certify every public asset or authorize deployment.

### Decisions and dependency-ready next work
Wave 5 checkpoint: e2fdc9d. Wave 6 changes are committed after this report and the verified evidence snapshots. No push, Vercel deployment, hosted connection, migration application, real provider invocation, registration certification or credential/consent change was performed.

Local decision: **PARTIAL**. All executable local gates PASS; full manual accessibility and approved model evaluation remain unresolved. Hosted decision: **NO-GO**.

Proposed B61–70, based on these gaps:
61. Executable isolated PostgreSQL/RLS harness once an approved local engine is available.
62. Async operations command and session persistence parity.
63. Real pooled-context, constraint, restart and concurrency certification.
64. Hosted identity HTTP/cookie/JWKS lifecycle integration with isolated provider fixtures.
65. Manual accessibility assessment and remaining remediation.
66. Approved model dataset/provider evaluation protocol; execution stays approval-gated.
67. Reviewed real integration transport and failure/rotation contract before any live delivery.
68. Consent/privacy/retention evidence collection and legal approval registry process.
69. Canonical pkg public-artifact packaging and authorized staging/rollback rehearsal.
70. Independent evidence review, credential-rotation/authentication verification and final release decision.

Credential, consent, infrastructure, model and deployment prerequisites remain separate gates throughout.

## Unchanged parking lot
Restricted-role PostgreSQL authentication 28P01; approved IWAY_CONSENT_VERSION; exposed owner password and service-role key rotation; hosted identity/persistence certification; approved AI provider; production deployment authorization. No gate is bypassed.
