# Changed-file inventory

Baseline d8208f459e2414dea6d9d85ad5e3ed964c9b991f to implementation/evidence HEAD dad608e4184deefc4e4c5508b62b7ac7aa9451a0. Final report-only commit additionally contains this report set and preserved local test logs. Original worktree is unchanged.

## Source, configuration and tests

- .gitattributes
- .github/workflows/verify.yml
- apps/operations/extended.js
- apps/operations/ops.js
- domain/operations-automation.mjs
- domain/operations-business.mjs
- domain/operations-documents.mjs
- domain/operations-features.mjs
- domain/operations-integration.mjs
- domain/operations-lifecycle.mjs
- domain/operations-projection.mjs
- domain/operations-provider.mjs
- domain/operations-transaction-timing.mjs
- domain/operations-transport.mjs
- domain/operations.mjs
- package.json
- scripts/certify-postgres.mjs
- scripts/lib/isolated-postgres.mjs
- scripts/lib/operations-migrations.mjs
- scripts/operations-benchmark.mjs
- scripts/operations-lock-experiment.mjs
- scripts/operations-repeat-local-benchmark.mjs
- server/operations-postgres.mjs
- server/operations-store.mjs
- supabase/migrations/20261011210552_operations_active_principal_rls.sql
- supabase/migrations/20261011220000_operations_actor_evidence.sql
- supabase/migrations/20261011221000_operations_dispatcher_directory.sql
- tests/browser/accessibility.spec.mjs
- tests/browser/operations.spec.mjs
- tests/helpers/operations-interrupted-worker.mjs
- tests/local/operations-postgres.test.mjs
- tests/operations-contention-recovery.test.mjs
- tests/operations-integration.test.mjs
- tests/operations-lifecycle.test.mjs
- tests/operations-multitenant-journey.test.mjs
- tests/operations-postgres.test.mjs
- tests/operations-provider.test.mjs
- tests/operations-recovery.test.mjs
- tests/operations-statement-cache.test.mjs
- tests/operations-transaction-timing.test.mjs
- tests/operations-transport.test.mjs

## Documentation and evidence

- docs/certification/wave1-wave2/: baseline, gap/implementation registers, root cause, performance, security, logistics, providers, test matrix, blockers, final report, inventories and hash-bound raw evidence.
- docs/execution/B181-B230-MASTER-PLAN.md: authoritative individual B187–B200 implementation/certification states.
- Earlier local PostgreSQL readiness documentation is restored with 5576354.

Full machine-readable baseline-to-final path inventory appears in evidence/summary.json; Git diff remains authoritative.
