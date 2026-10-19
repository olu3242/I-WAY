# R4 PostgreSQL parity evidence gate

Run `node scripts/r4-postgres-parity-gate.mjs evidence.json` on a reviewer-curated, immutable hosted nonproduction test record. Required: pinned commit, complete expected command inventory, zero failed/missing commands, real tenant-isolation/RLS/authentication assertions, synthetic fixture attestation, evidence digest, and independent approval.

**Caution:** `tests/hosted/postgres.test.mjs` currently exercises early-access registration with a dedicated registration login; it is **not** proof of operational command parity. The historical 39/72 coverage count is not accepted as complete. Operational command tests and their actual database authority must be established independently. Do not manufacture evidence or infer completion from a passing CI run.

Output `ELIGIBLE_FOR_REVIEW` is not certification. Production stays NO-GO until all R1–R10 prerequisites and release approvals are satisfied.
