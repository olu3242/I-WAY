# Root-cause analysis

Measured local experiments only; no hosted capacity inference. Original reports and raw numeric samples remain immutable. Phase comparisons are two diagnostic runs with instrumentation, not acceptance runs or a controlled causal estimate.

| Snapshot | Scenario | Acquire p95 ms | Execute p95 ms | Finalize p95 ms | Commits | Expected rollbacks | Startup ms |
|---|---|---:|---:|---:|---:|---:|---:|
| before | dispatch | 264.928 | 15.263 | 4.397 | 6 | 18 | 1851.835 |
| before | workflow | 98.528 | 9.278 | 5.248 | 75 | 0 | 1891.904 |
| before | documents | 152.822 | 22.432 | 7.381 | 48 | 0 | 1645.680 |
| before | tenant_isolation | 44.558 | 4.833 | 0.122 | 0 | 24 | 1716.291 |
| after | dispatch | 253.758 | 12.180 | 4.268 | 6 | 18 | 1737.953 |
| after | workflow | 88.913 | 8.431 | 6.367 | 77 | 0 | 1679.633 |
| after | documents | 133.933 | 38.652 | 7.359 | 48 | 0 | 2001.666 |
| after | tenant_isolation | 52.240 | 9.009 | 0.319 | 0 | 24 | 1661.265 |

The original four-worker counter experiment acquires the SQLite write lock mostly in fractions of a millisecond. The application workload adds substantial critical-section execution, durable commit, cold-worker initialization, and competing lock waits. The dispatch workload deliberately pits four requests against one version; its 18 rejected transactions per six rounds are expected conflicts, not lost committed writes.

Repeated SQL compilation in earlier profiling supports the seven prepared-statement cache. It caches executable statements only; principal and tenant data are freshly read inside each transaction. Bounded timeout/exhaustion and killed-worker tests verify rollback. No speculative write serialization, new retry loop, busy-timeout change, WAL change, or FULL synchronous change was applied.

Gate A application runs improved over the measured pre-cache snapshot but still varied enough to fail dispatch and documents in multiple repetitions. Phase totals are affected by scheduling, host CPU, disk latency and worker start; acquisition wall time cannot uniquely separate these. A controlled host is still required to distinguish host scheduling from storage cost and to claim reproducibility. See performance-results.md for every unchanged acceptance run, including failures.

Timing boundary: startupMs runs from worker spawn to all workers ready and is excluded from the reported application throughput denominator. elapsedMs starts at the common start signal and ends when workers exit, so it includes work plus worker teardown. First-use initialization inside commands still appears in execution. The dominant observed p95 phase is acquisition for dispatch/documents in both diagnostic snapshots; it includes lock waiting and scheduling. Worker startup alone cannot explain a failed work/s threshold. Final host snapshot records only 738,570,240 free memory bytes of 16,847,921,152 total, with about 131 GB available on the repository volume. This supports resource pressure as a confounder, not proof of paging or a specific disk defect.

Final result: dispatch, workflow and tenant-isolation throughput met their original floors in all five runs; documents met its floor in four of five. No correctness or unexpected-error defect occurred. This confirms improvement over the before snapshot but does not establish an invariant performance margin. B189 remains FAILED; no further source optimization is justified solely by the narrowly missed noisy threshold. Final host CPU and memory ranges are recorded in performance-results.md and raw host-N.json.
