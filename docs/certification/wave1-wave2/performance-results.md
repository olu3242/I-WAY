# Performance execution evidence

B187: the original d8208f4 experiment ran unchanged first. Numeric phase instrumentation was then added without changing 20 transactions per worker, WAL/FULL, or the original acquisition measurement. Five one-worker repetitions committed 20/20 each; five four-worker repetitions committed 80/80 each. Every worker completed; no rollback, timeout, or silent loss occurred in successful experiments. Raw bounded phase samples are retained. Acquisition includes scheduling and SQLite lock wait; busy-handler retries are not separately observable.

B188: restored the prior evidence-supported seven-statement cache without caching authorization/results. Fixed the diagnostic classification of a failed BEGIN: it is now acquisition failure, not callback execution or rollback. Ten focused tests pass, including real lock timeout, bounded caller retries, process interruption rollback, and concurrent dispatch/documents. No retry loop, busy-timeout change, or durability relaxation was introduced.

B189: **LOCAL_REPEAT_FAIL**. Five unchanged four-worker/six-round application runs are retained. A failed repetition cannot be averaged away. Diagnostic runs are separate and excluded from acceptance. The approved baseline has p95 and throughput limits but no p99 threshold; measured p99 is reported without inventing approval.

| Run | Scenario | p50 ms | p95 ms | p99 ms | work/s | Status |
|---|---|---:|---:|---:|---:|---|
| 1 | dispatch | 6.316 | 223.336 | 318.539 | 14.419 | PASS |
| 1 | workflow | 2.974 | 406.585 | 675.025 | 36.597 | PASS |
| 1 | documents | 17.463 | 298.384 | 323.449 | 38.849 | PASS |
| 1 | tenant_isolation | 30.813 | 122.735 | 145.957 | 63.617 | PASS |
| 2 | dispatch | 8.495 | 352.907 | 470.141 | 9.390 | FAIL |
| 2 | workflow | 4.398 | 324.510 | 659.555 | 38.641 | PASS |
| 2 | documents | 17.175 | 395.932 | 593.644 | 33.558 | PASS |
| 2 | tenant_isolation | 36.004 | 117.033 | 139.809 | 56.940 | PASS |
| 3 | dispatch | 6.651 | 370.773 | 484.452 | 10.110 | FAIL |
| 3 | workflow | 2.605 | 378.091 | 807.658 | 33.562 | PASS |
| 3 | documents | 18.807 | 472.182 | 582.289 | 29.762 | FAIL |
| 3 | tenant_isolation | 35.286 | 169.483 | 178.458 | 52.605 | PASS |
| 4 | dispatch | 7.084 | 451.787 | 563.650 | 9.132 | FAIL |
| 4 | workflow | 5.649 | 489.706 | 714.450 | 31.583 | PASS |
| 4 | documents | 17.416 | 395.504 | 615.878 | 31.081 | FAIL |
| 4 | tenant_isolation | 37.662 | 153.015 | 191.481 | 44.709 | PASS |
| 5 | dispatch | 7.202 | 295.616 | 370.988 | 12.691 | PASS |
| 5 | workflow | 3.918 | 359.186 | 691.227 | 35.681 | PASS |
| 5 | documents | 16.969 | 275.497 | 507.530 | 35.843 | PASS |
| 5 | tenant_isolation | 27.979 | 97.121 | 217.543 | 57.953 | PASS |

Root-cause limit: isolated counter-write acquisition is usually sub-millisecond while application contention tails are much larger. Longer application critical sections and competing worker/host scheduling amplify lock waits; this evidence does not establish a unique storage-device cause. Prior profiling demonstrated repeated SQL compilation, supporting statement reuse. Host and storage attribution still require a controlled host if the unchanged budget continues to fail.

SQLite development measurements are not PostgreSQL hosted capacity or SLO evidence. Later feature additions require final regression reruns; these files remain the immutable Gate A comparison.
