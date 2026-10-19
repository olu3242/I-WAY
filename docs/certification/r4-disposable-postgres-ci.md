# R4 disposable PostgreSQL CI

The `Disposable PostgreSQL Operations` workflow runs on the R1–R10 certification branch and supports manual dispatch. It creates a loopback-only, ephemeral PostgreSQL 16 fixture with generated credentials and TLS, then executes `tests/local/operations-postgres.test.mjs`.

The workflow does not use hosted secrets, connect to production, or change an existing database. It checks the bounded local async Operations persistence adapter: migrations, restricted role, forced RLS, tenant isolation, idempotency, contention, transaction rollback and audit immutability.

**Limitations:** local adapter coverage is not 72-command HTTP parity, hosted persistence, cross-host durability or production authorization. An independently verified hosted R4 dossier is still required.
