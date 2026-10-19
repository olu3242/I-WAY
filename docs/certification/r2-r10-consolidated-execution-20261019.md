# R2–R10 consolidated certification batch — 2026-10-19

**Decision: PARTIAL / NO-GO.** A passing CI run verifies the checked-in candidate, not hosted production readiness. The register is intentionally fail-closed: source existence never implies a certified gate.

Run `node scripts/r2-r10-gates.mjs` for a human-readable inventory or `node scripts/r2-r10-gates.mjs --json` for machine-readable evidence gaps. Run `node --test tests/r2-r10-gates.test.mjs` for register invariants.

| Gate | Workstream | Required exit evidence |
| --- | --- | --- |
| R2 | Persona browser acceptance | CI browser pass plus approved human QA |
| R3 | Identity / tenant security | Verified role model, cross-tenant tests, independent security approval |
| R4 | PostgreSQL parity | Hosted command-path coverage and isolation results |
| R5 | Governed agents | Durable jobs, handoff tests, self-heal/recovery and approved model consent |
| R6 | Tracking SLO | Baseline/after/repeat performance evidence with approved thresholds |
| R7 | Recovery | Hosted backup/restore and RPO/RTO signed evidence |
| R8 | Integrations | Approved sandbox adapter and payments evidence |
| R9 | Hosted operations | Trusted transport, secrets handling, observability and security sign-off |
| R10 | Release | R1 source reconciliation, R2–R9 acceptance and explicit production approval |

## Verified versus pending
- CI run 39333605497: passed, including 19 Chromium browser tests. Later workflow revisions require their own verification.
- GitHub source branch does not establish recovery of the reported October 17 local 736-file checkpoint at 32d9726.
- Hosted evidence is not produced by this batch; do not mark hosted PostgreSQL, payments, agent learning, live-model use, SLO or production deployment complete.
- No production resources are accessed, no release is approved, and no merge to main is authorized by this register.

## Acceptance procedure
1. Reconcile R1 source archive and checksum with remote candidate.
2. Run full unit, integration, browser, accessibility and security suites.
3. Execute approved isolated and hosted PostgreSQL tests, including tenant isolation.
4. Reproduce tracking performance with immutable before/after/repeat measurements.
5. Validate agent execution/recovery and sandbox integrations under consent.
6. Collect signed hosted recovery, security and operations evidence.
7. Have authorized reviewers accept each gate; only then request R10 production decision.

The script reports source availability and conservative status; it is **not** a substitute for signed gate evidence.
