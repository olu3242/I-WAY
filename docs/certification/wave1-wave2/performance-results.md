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

## Final implementation series

Executed sequentially after full verification, with no concurrent agent-started tests. Source implementation 6dea4ca; unchanged four-worker/six-round workload, WAL/FULL and original baseline budgets. **LOCAL_REPEAT_FAIL: 4/5 runs PASS.** Documents in run 1 measured 31.0469818453 work/s against 31.1385418599 minimum (see original baseline for exact value); failure is retained without averaging. Every scenario passed latency, memory, unexpected-error and correctness checks. No approved p99 limit exists.

| Run | Scenario | p50 ms | p95 ms | p99 ms | work/s | Result |
|---|---|---:|---:|---:|---:|---|
| 1 | dispatch | 4.608 | 318.987 | 377.986 | 12.924981 | PASS |
| 1 | workflow | 3.023 | 347.631 | 565.461 | 37.766071 | PASS |
| 1 | documents | 19.525 | 388.970 | 591.848 | 31.046982 | FAIL |
| 1 | tenant_isolation | 27.468 | 140.587 | 171.618 | 58.866410 | PASS |
| 2 | dispatch | 5.170 | 360.278 | 456.986 | 11.068252 | PASS |
| 2 | workflow | 3.712 | 404.157 | 644.432 | 29.113426 | PASS |
| 2 | documents | 20.688 | 397.128 | 600.788 | 31.922658 | PASS |
| 2 | tenant_isolation | 24.048 | 253.682 | 307.171 | 47.324733 | PASS |
| 3 | dispatch | 4.689 | 344.721 | 443.977 | 11.462656 | PASS |
| 3 | workflow | 3.430 | 278.217 | 581.905 | 41.459072 | PASS |
| 3 | documents | 16.936 | 389.429 | 583.472 | 33.541266 | PASS |
| 3 | tenant_isolation | 32.519 | 113.337 | 169.173 | 62.982604 | PASS |
| 4 | dispatch | 5.565 | 278.595 | 339.066 | 14.012088 | PASS |
| 4 | workflow | 3.441 | 321.952 | 659.068 | 39.112853 | PASS |
| 4 | documents | 16.674 | 314.772 | 604.459 | 32.127349 | PASS |
| 4 | tenant_isolation | 30.912 | 110.486 | 147.343 | 62.221688 | PASS |
| 5 | dispatch | 4.803 | 322.341 | 430.642 | 11.804540 | PASS |
| 5 | workflow | 2.953 | 477.600 | 656.852 | 41.037005 | PASS |
| 5 | documents | 17.997 | 274.677 | 526.508 | 36.045442 | PASS |
| 5 | tenant_isolation | 25.432 | 143.967 | 232.233 | 57.287358 | PASS |

| Scenario | Before p50 / p95 / p99 ms | Before work/s | Final work/s range | Original work/s floor | Final pass count |
|---|---|---:|---:|---:|---:|
| dispatch | 9.346 / 577.482 / not recorded | 7.265936 | 11.068252–14.012088 | 10.7860223936 | 5/5 |
| workflow | 4.103 / 607.636 / not recorded | 35.398773 | 29.113426–41.459072 | 27.8157669039 | 5/5 |
| documents | 21.849 / 485.784 / not recorded | 27.670924 | 31.046982–36.045442 | 31.1385418599 | 4/5 |
| tenant_isolation | 54.156 / 142.045 / not recorded | 44.099796 | 47.324733–62.982604 | 42.7116562779 | 5/5 |

Bounded host measurements (one-second host CPU deltas, maximum 600 samples per run):

| Run | Samples | Mean host CPU busy % | Max host CPU busy % | Minimum free MiB |
|---|---:|---:|---:|---:|
| 1 | 17 | 63.25 | 100.00 | 2664.5 |
| 2 | 17 | 76.16 | 99.62 | 2656.8 |
| 3 | 17 | 67.69 | 98.62 | 2699.1 |
| 4 | 15 | 64.93 | 95.62 | 2686.7 |
| 5 | 18 | 58.26 | 90.88 | 2997.1 |

Raw per-worker resource usage, worker startup, elapsed work/teardown, expected conflicts and all invariants are preserved in final-series/run-N.json. Phase details remain in the separate before/after diagnostic snapshots; acceptance runs do not enable transaction instrumentation. Host profiling identifies no tenant, actor, SQL, payload or process name. The wrapper refuses an existing output directory or stale benchmark run ID. No process was stopped and no host tuning was applied.
