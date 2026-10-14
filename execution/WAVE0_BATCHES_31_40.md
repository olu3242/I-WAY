# I-way Batches 31–40 — Persistence hardening

Prior GitHub Actions runs on commit 3774fcd7 completed successfully. This document records the subsequent implementation and its remaining certification gates.

| Batch | Deliverable | State |
|---|---|---|
| 31 | Confirm previous CI outcome | PASS |
| 32 | Add SQL migration with unique email hash | PARTIAL: migration not applied to hosted database |
| 33 | Add PostgreSQL registration adapter | PARTIAL: unit-tested adapter, not live-connected |
| 34 | Use parameterized SQL | PARTIAL: tested with injected query client |
| 35 | Enforce database-level duplicate registration | PARTIAL: requires migration and hosted test |
| 36 | Require explicit consent | PARTIAL: validation and SQL constraint, legal review pending |
| 37 | Improve file-store durability | PARTIAL: local fsync, no distributed guarantees |
| 38 | Add PostgreSQL adapter tests | PENDING CI |
| 39 | Provide environment template | PASS |
| 40 | Hosted production certification | BLOCKED: database connection and deployment not configured |

## Critical remaining work

- Connect the HTTP registration handler to PostgreSQL through a deployed runtime. The adapter alone is not an E2E PostgreSQL implementation.
- Verify real database migration, permissions, persistence across server restart and concurrent registrations.
- Replace in-memory throttling with shared durable rate limits for multi-instance deployments.
- Add consent policy/version, retention/deletion process, anti-bot controls and operational alerting.
- Complete actual browser E2E, accessibility, IP and legal sign-off.

**Release gate: NO-GO.** Do not report R0 as production ready.
