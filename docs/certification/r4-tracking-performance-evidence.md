# I-WAY R4 tracking performance certification evidence

Evidence captured 2026-10-20 UTC from GitHub Actions on the isolated work branch.

## Verified execution

- Source commit: `8be949afb3eafc8721122ce8eccc8e035021f838`.
- Disposable PostgreSQL Operations: **success**, run [39358553507](https://github.com/olu3242/I-WAY/actions/runs/39358553507).
- The workflow invokes the 40-case benchmark policy suite, three independent disposable PostgreSQL certification executions, and the comparison script. The successful job establishes that these stages exited successfully.
- Tracking baseline artifact: `tracking-postgres-baseline`, artifact ID `12235848417` (14-day retention configured).
- Full Verify: run [39358553509](https://github.com/olu3242/I-WAY/actions/runs/39358553509) was **in progress at evidence capture**. Do not treat as passed until confirmed.

## Repeated measurements

Workload: one shipment with 64 tracking records, ordered by timestamp and ID, `LIMIT 20`. Each independent disposable PostgreSQL run performs three warm-ups followed by 21 timed `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` queries.

| Independent run | Median execution (ms) | p95 execution (ms) |
| --- | ---: | ---: |
| 1 | 0.015 | 0.016 |
| 2 | 0.015 | 0.016 |
| 3 | 0.015 | 0.016 |

The three-run median and p95 ratios are both 1.00 for this CI execution. These numbers are **database execution times**, not application or end-to-end API latencies. The fixture is small and does not represent production concurrency or data volume.

## Decision and remaining gates

- The comparison script validates raw samples, quantiles, query plan shape, workload identity and sample metadata; invalid reports fail the CI comparison.
- The report intentionally records `performanceGateEnabled: false` and `productionSloCertified: false`.
- No production SLO or hard latency threshold has been certified.
- Before enabling a performance regression threshold: run representative high-volume workloads, measure concurrent tenant-scoped access, record API p50/p95/p99 and error rates, assess host-to-host variance, and define an approved baseline and rollback policy.
- Before production GO: separately certify hosted PostgreSQL, RLS and secrets, external integrations, end-to-end business flows, recovery, and deployment observability.

**R4 evidence disposition: local PostgreSQL benchmark pipeline verified; production NO-GO.**
