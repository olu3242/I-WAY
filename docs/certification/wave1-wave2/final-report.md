# B187–B200 final local execution report

**NO-GO for production and aggregate certification.** Local functionality is implemented and full verification passes, but repeated performance and browser gates fail; hosted certification has not executed.

## Repository and preservation

- Worktree: C:/Cdev/I-WAY-wave1-wave2; branch feat/iway-wave1-wave2-b187-b200.
- Starting integration SHA: d8208f459e2414dea6d9d85ad5e3ed964c9b991f.
- Ending implementation/measurement SHA: dad608e4184deefc4e4c5508b62b7ac7aa9451a0. The subsequent completion commit contains reports/evidence only and is identified in the final response and Git history.
- Original C:/Cdev/I-WAY-app remains on 036d72564bad1d14b272fd3dd9ce2b533535ee71. All six pre-existing local files, stash abd9f85372709ed761f2c11b612c7dbb732212ef, both original manifests, and all 61 referenced historical artifacts retain their hashes.
- No discarded files, force push, merge, hosted test, live message, model call, deployment or production activation.

## Commits

- bacecf0 perf(B187-B189): measure repeated contention and preserve failed gates
- 5576354 fix(postgres): enforce scoped transactions and certify isolated operations
- c0e12af test(browser): allow complete accessibility and logistics journeys
- fa45171 fix(B190): verify atomic migrations and expanded PostgreSQL isolation
- 6dea4ca feat(B191-B199): integrate audited lifecycle and isolated tenant journeys
- dad608e test(B189): retain five final performance runs and host measurements

## Results

| Gate | Actual result |
|---|---|
| Full npm run verify | PASS 399/399, 0 failed/skipped; IP scan and four-page structure PASS |
| Approved disposable TLS PostgreSQL | PASS 16/16, 0 skipped; no hosted claim |
| Browser | FAIL 11/12, 0 skipped; existing 180-second accessibility sweep timeout |
| Accessibility automation | 55 scans, zero reported violations; timed-out sweep and manual checks unresolved |
| Final unchanged performance series | FAIL repeat gate: four runs PASS, one FAIL |
| Recovery measured separately | PASS all six checks; 1986.5056 ms RTO versus unchanged 10000 ms limit |
| Local deterministic evaluation | PASS 12/12; model evaluation BLOCKED, zero inference calls |
| Public target check | PASS canonical entry-file check; deploymentExecuted=false |
| Aggregate validator | FAIL ACCESSIBILITY_GATE; performance also independently fails |
| Hosted/staging, live providers and live notifications | BLOCKED; not executed |
| Separate lint/typecheck/build scripts | Unavailable in package.json; no invented substitute |

Earlier attempts remain: initdb sync timeout; a corrected PG negative-test UUID cast error; corrected projection reference defect; corrected audit test field assumption; first full suite 397/398 with recovery failure; an interrupted full-suite attempt with no result. Later successful execution does not erase any of these records. See test-matrix.md for every attempt.

## Batch outcome

| Batch | Local implementation | Certification / acceptance |
|---|---|---|
| B187 | TESTED: original + five single/four-worker experiments | PARTIAL: finite workload completed; unique host/storage cause not proven |
| B188 | TESTED: statement reuse, accurate failure timing, rollback safety | PARTIAL: correctness PASS, performance margin remains variable |
| B189 | TESTED: five final unchanged runs | FAILED: documents missed throughput once |
| B190 | TESTED: local migration/RLS/role/atomicity suite | BLOCKED hosted; local PASS 16/16 |
| B191 | TESTED: Ready/Closed milestones and atomic mirror | Local PASS; production BLOCKED; Ready optional for compatibility |
| B192 | TESTED: cancellation/reassignment and approved capacity application | Local PASS; hosted BLOCKED |
| B193 | TESTED: occurrence time, deduplication, ordering/provenance | Local PASS; provider evidence remains unapplied until human action |
| B194 | TESTED: eight exception types, persisted human recovery | Local PASS; production BLOCKED |
| B195 | TESTED: digest verification and BOL/POD-gated closure | Local PASS; hosted storage BLOCKED |
| B196 | TESTED: opted-in local lifecycle notifications | Simulated PASS; live consent/provider activation BLOCKED |
| B197 | TESTED: governed adapters and bounded fixture transport | Contract PASS; live provider BLOCKED |
| B198 | TESTED: callback/timeout/replay/circuit/receipt resilience | Simulated PASS; live service evidence BLOCKED |
| B199 | TESTED: concurrent tenant HTTP journeys and PG RLS matrix | Local PASS; hosted full adapter BLOCKED |
| B200 | BLOCKED: local reference journey complete | Hosted journey not executed |

This table summarizes the authoritative docs/execution/B181-B230-MASTER-PLAN.md register. No IMPLEMENTED or TESTED item is counted as production CERTIFIED. No percentage is asserted; all mandatory release gates must pass independently.

## Performance and root cause

Final document run 1: 31.0469818453 work/s versus original floor 31.1385418599. Dispatch, workflow and tenant-isolation floors passed all five runs; documents passed four. Every final p95, correctness, memory and unexpected-error check passed. No approved p99 budget exists. Full before/after p50/p95/p99 and throughput tables are in performance-results.md.

Diagnostic acquisition p95 for dispatch fell from 264.928 to 253.758 ms and documents from 152.822 to 133.933 ms across the separate before/after snapshots. These are observations, not a controlled causal estimate. Isolated counter-write acquisition is usually sub-millisecond. Application critical sections, scheduling and durable commit amplify lock waits. Statement reuse is evidence-supported; no result/authorization cache, durability reduction, retry-policy relaxation or workload change was introduced. Host CPU/memory samples and attribution limits are retained in root-cause.md and raw JSON. Worker startup is separately measured and excluded from application work/s; teardown remains included.

## Remaining blockers and next safe actions

1. Resolve repeated-performance variability on a controlled host and rerun the unchanged suite; do not average away the failed repetition.
2. Complete the existing browser accessibility sweep within its unchanged deadline and manual accessibility review.
3. Supply an approved staging environment, restricted database role and complete async HTTP/session/domain adapter before hosted B190/B199/B200 execution.
4. Obtain approved provider/communication contracts, consent language and scoped staging credentials before any live activation.

Owners and safe next steps are in blockers.md. Changed files are listed in changed-files.md; exact source/artifact hashes and aggregate decisions are in evidence/summary.json and evidence/aggregate/. Final scope is local engineering and evidence collection only.
