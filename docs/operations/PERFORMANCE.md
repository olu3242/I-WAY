# Local operations performance evidence

Run node scripts/operations-benchmark.mjs from the project. It creates disposable fixtures and independent Node processes. It never discovers or loads an application database, environment file, or hosted endpoint.

The fixed workload uses four workers and six rounds:

| Scenario | Work and correctness gate |
| --- | --- |
| Dispatch | Four processes compete for each of six validated shipments, using distinct eligible driver/vehicle pairs. Exactly six assignments win; 18 conflicts are expected. |
| Workflow | Processes race across six five-step advisory jobs. Exactly 30 immutable checkpoint decisions persist and every job completes. |
| Documents | Each process ingests/reviews six BOL documents. All 24 pairs must validate. |
| Tenant isolation | Each process makes six unauthorized cross-tenant requests and reads its projected state. All 24 requests must be denied, without foreign shipment visibility. |

Workers use a start barrier after opening independent SQLite connections. Startup and workload time are measured separately. Latency units are reported per scenario: dispatch/authorization command, ingestion/review pair, or checkpoint batch. Workflow throughput counts committed decisions. Expected conflicts/denials are separate from unexpected errors.

The artifact dist/operations-evidence/performance.json records p50/p95/max latency, throughput, errors, sample sizes, worker CPU time, peak RSS, sampled heap, runtime/hardware metadata, and persisted invariant checks. It contains no tenant IDs, document contents, credentials, user names, paths, or environment values.

## Fixed baseline and budgets

The retained docs/operations/PERFORMANCE_BASELINE.json calibration was measured with:

~~~text
node scripts/operations-benchmark.mjs --calibrate docs/operations/PERFORMANCE_BASELINE.json
~~~

Calibration only creates a new baseline and reports BASELINE_ONLY; it cannot certify its own run. Normal verification executes an independent workload against that retained baseline.

Regression limits are:

- p95 no more than four times calibration, with a 750 ms floor.
- Throughput at least one fifth of calibration.
- Peak worker RSS no more than twice calibration, with a 192 MiB floor.
- Zero unexpected errors; every persisted correctness/isolation invariant passes.

The baseline contains measured values and resulting numerical budgets. Refresh requires a new reviewed calibration file; verification never silently recalibrates after failure. Workload configuration must match.

## Initial independent verification

Measured on 2026-10-11 with Node 24.16 on this Windows workstation:

| Scenario | p95 | Work/second | Unexpected errors |
| --- | ---: | ---: | ---: |
| Dispatch | 73.02 ms | 49.18 | 0 |
| Workflow batch | 140.43 ms | 164.57 checkpoints/s | 0 |
| BOL ingestion/review | 90.49 ms | 121.69 | 0 |
| Tenant isolation | 40.31 ms | 219.24 | 0 |

Peak worker RSS was approximately 67.3 MB. Latest machine evidence is authoritative for subsequent runs.

This small SQLite regression workload does not establish hosted capacity, maximum tenants, sustained production throughput, or a production SLO. Saturation, realistic volume, disk failure, remote networking, and hosted PostgreSQL remain separate certification work.
