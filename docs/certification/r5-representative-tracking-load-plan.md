# R5 representative tracking-load certification plan

**Decision: NOT CERTIFIED / production NO-GO.** This plan defines the evidence required; it does not claim that hosted infrastructure or a representative API load test has run.

## Existing evidence and limits

- R4 disposable PostgreSQL tracking-history baseline: three isolated database runs, each with three warm-ups and 21 measured queries, 64 events, LIMIT 20.
- Verified PostgreSQL CI: https://github.com/olu3242/I-WAY/actions/runs/39358825104
- The benchmark measures SQL execution only. It does not include HTTP routing, authentication, authorization, TLS, network time, concurrency, or hosted storage.
- `scripts/tracking-slo-gate.mjs` already implements a fail-closed tracking performance evidence assessment; reuse it rather than inventing an alternative production gate.
- `scripts/operations-benchmark.mjs` and `scripts/operations-repeat-local-benchmark.mjs` provide existing local performance tooling; do not equate these with hosted API measurements.

## Required representative test matrix

| Dimension | Minimum scenarios |
| --- | --- |
| Shipment history | 64, 1,000, 10,000 and 100,000 tracking events per shipment |
| Concurrency | 1, 4, 16 and 32 authenticated clients |
| Tenant isolation | Same-tenant, cross-tenant denied, and parallel tenant workloads |
| API paths | First tracking page, cursor pagination, latest location, and unauthorized access |
| Measurements | p50/p95/p99 response latency, throughput, error count, CPU/memory, and query plan |
| Repeatability | At least three independent comparable runs per selected load profile |
| Recovery | Connection interruption, timeout, retry/idempotency, and restart |
| Data integrity | No skipped/duplicated events across pages; deterministic ordering and tenant isolation |

## Execution and approval requirements

1. Obtain explicit authorization for a disposable or dedicated hosted staging environment and its test data; never run high-load certification against live customer data without approval.
2. Pin source commit, PostgreSQL version, API version, fixture digest, runner size and region; retain raw samples.
3. Capture baseline and candidate at identical concurrency, history size and test duration. Include warm-up separately.
4. Record throughput and tail latency from the API caller's perspective, plus error rates and database telemetry.
5. Obtain approved numeric SLOs from the release owner before evaluating `scripts/tracking-slo-gate.mjs`. Do not derive a production SLO from the 64-row disposable SQL baseline.
6. Use the existing fail-closed gate with before/after/repeat evidence; publish machine-readable results and independent QA sign-off.
7. Keep deployment blocked until hosted PostgreSQL RLS/security, external integrations, end-to-end workflows, recovery, and observability are certified.

## Status

R4 local database performance evidence exists. **R5 representative hosted/API execution: not run.** Numeric production SLO: **not approved**. Release decision: **NO-GO**.
