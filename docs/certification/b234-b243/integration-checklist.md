# B234-B243 integration certification checklist

Status: LOCAL CERTIFICATION PENDING; HOSTED NO-GO.

## Batch inventory
- B234-B235: cross-application event contract exists; durable runtime wiring not certified.
- B236-B238: dispatch/capacity/recovery decision gate exists; transactional execution wiring not certified.
- B239-B240: finance/document eligibility gate exists; operational domain integration not certified.
- B241-B242: sanitized outcome classifier exists; telemetry pipeline and recovery scheduler wiring not certified.
- B243: integrated certification checklist (this document); not a certification receipt.

## Required evidence before release
1. Full npm run verify with actual pass count and clean exit.
2. Browser E2E, including accessibility and persona isolation.
3. Isolated PostgreSQL transaction, role, RLS, replay and cross-tenant tests.
4. Operational benchmarks against unchanged thresholds, including document throughput.
5. Integration tests proving persisted workflow checkpoints invoke current gates and recheck authorization and resource versions inside transactions.
6. Recovery tests proving durable lease fencing, retries, dead letters and no duplicate financial or external side effects.
7. Human approval tests for dispatch, financial issuance, document review and exception resolution.
8. Explicitly authorized hosted probes, approved consent, trusted TLS, credential preflight and hosted audit evidence.
9. Human IP/security review and immutable evidence manifest.

No production activation, migrations, secrets, deployment or hosted writes are authorized by this checklist.
