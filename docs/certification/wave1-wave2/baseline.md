# B187–B200 baseline

- Repository: olu3242/I-WAY; application integration baseline is origin/feat/ai-native-decision-plane, verified by its B187 commit and domain/test history. origin/main is not the application baseline.
- Starting SHA: d8208f459e2414dea6d9d85ad5e3ed964c9b991f; branch feat/iway-wave1-wave2-b187-b200; isolated worktree C:/Cdev/I-WAY-wave1-wave2.
- Original worktree stays on 036d72564bad1d14b272fd3dd9ce2b533535ee71, with six local files and the original stash untouched. The branches diverge by seven local and 44 remote commits. No merge, push, or deployment authorized.
- d8208f4 exists and its original four-worker/20-iteration experiment executed successfully: 80 commits, acquisition p50 0.1412 ms, p95 0.2835 ms, maximum 50.5658 ms. This is diagnostic, not application certification.

## Reconciliation

The authoritative register remains docs/execution/B181-B230-MASTER-PLAN.md. It groups historical objectives differently from the current prompt; this program will keep explicit B187–B200 rows there and supporting detail here. B181–B186 code exists: bounded transaction timing, read-only diagnostic summary/CLI, independent performance-series assessment, and fail-closed tests (commits aa606ba through 0396bf3). The register's NOT_STARTED rows are stale; code existence does not establish executed PASS.

Existing capabilities include scoped load/shipment transactions, dispatch eligibility and approvals, document/POD versioning, durable runtime checkpoints, integration inbox/outbox, provider resilience, customer portal, and SQLite/async PostgreSQL adapters. Remote adds indexed document/runtime queries and immutable timezone formatters. Earlier local PostgreSQL fixes and fixture tests are absent from this baseline and require reconciliation.

## Tooling and environment

Node >=24.13, npm/package-lock, native ESM, node:test, Playwright/axe, PostgreSQL migrations under supabase/migrations, native SQLite WAL/FULL. node_modules is a junction to the existing unchanged locked dependency installation; no environment or credential files were copied. Actual scripts include verify, test:browser, ops:benchmark, ops:certify, and guarded PostgreSQL checks. No separate typecheck, lint, or production build script exists. CI currently requests Node 22 despite the Node 24 engine requirement; this is a confirmed configuration defect. Vercel exposes site/public only.

## Gates and dependencies

The prior immutable performance baseline has four workers/six rounds, p95 ceilings of 750 ms, and separate throughput floors. Prior local performance and browser evidence failed; hosted security, full asynchronous PostgreSQL HTTP/session/workflow parity, hosted recovery, live providers/models, manual accessibility, and legal consent remain uncertified. Local disposable PostgreSQL with TLS is approved; hosted credentials/permissions have not been provided for this isolated worktree. No hosted environment files are loaded or credentials requested for routine local work.

Migration consistency, role/RLS execution, lifecycle closure/notifications, multi-tenant API integration and provider callback gaps are being checked against source and tests. They remain IN_PROGRESS until executable evidence is recorded.
