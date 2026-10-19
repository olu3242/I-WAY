# R6 Tracking performance regression gate

Run `node scripts/tracking-slo-gate.mjs <evidence.json>` with a reviewer-approved SLO and **actual** baseline, after and repeat measurements from the same environment, fixture and concurrency. The evaluator checks numeric completeness, minimum 100 requests per run, error counts, p95, throughput and regression against baseline.

A successful result is **ELIGIBLE_FOR_REVIEW**, never production certification. An independent reviewer must verify source hashes, measurement provenance, comparability and approved SLO. Missing evidence, missing approvals or regressed metrics produce **NO-GO**.

The October 17 reported tracking measurements (baseline p95 223.61 ms / 34.26 requests/s; after 483.28 ms / 14.50 requests/s; repeat 295.35 ms) indicate regression. These are historical reports, not verified R6 input; do not silently substitute them for a signed evidence file.

This gate does not initiate hosted testing or access production resources.
