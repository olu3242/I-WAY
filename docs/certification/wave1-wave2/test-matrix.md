# Actual execution matrix

All commands use isolated synthetic local fixtures; no hosted test ran. Intermediate failures are retained verbatim. No skipped or incomplete test is counted as PASS.

| Command / evidence | Actual result | Scope and limitation |
|---|---|---|
| Original B187 experiment + 5 one-worker + 5 four-worker runs | PASS: 20/20 or 80/80 commits each | Counter workload only; raw bounded phases preserved |
| B188 focused transaction tests / b188-focused.log | PASS 10/10, 0 skipped | Cache freshness/revocation, rollback, timeout/exhaustion and interrupted writer |
| Gate A unchanged benchmark / b189-run-1..5.json | FAIL repeat gate: 2 PASS, 3 FAIL | Exact approved four-worker/six-round workload and budgets |
| Existing document/business/automation tests / b191-existing-focused.log | PASS 41/41 | Intermediate source snapshot |
| New lifecycle tests / b191-b196-focused.log | PASS 6/6 | Intermediate snapshot; final suite includes added rollback test |
| Broader provider/lifecycle / b197-b198-focused.log | FAIL 4/27 | Projection reference defect, fixed; retained |
| Corrected focused suite / b191-b199-focused-fixed.log | FAIL 27/28 | Test assumed audit API exposed tenant field; corrected to persisted sequence membership |
| Concurrent two-tenant HTTP / b199-http-fixed.log | PASS 1/1 | Complete journeys and eight-resource/audit denial matrix |
| npm run test:pg:local -- --operations-isolated / b190-postgres.log | BLOCKED during initdb sync timeout | No security test executed |
| PostgreSQL retry / b190-postgres-retry.log | FAIL 14/16 (parent included) | Negative test UUID/text type mismatch; corrected |
| PostgreSQL corrected / b190-postgres-fixed.log | PASS 16/16, 0 skipped | Restricted role, verified TLS, RLS, migrations, rollback, concurrent updates |
| npm run verify / verify-final.log | FAIL 397/398, 0 skipped | Recovery rehearsal was sole failure; later scan/site steps did not execute |
| npm run verify / verify-rerun.log | BLOCKED/incomplete | No final counts/exit code; process absent after interrupted session; not PASS |
| Recovery measured alone / recovery-final.json | PASS all 6 checks, RTO 1986.5056 ms | Existing limit 10000 ms unchanged; expected two lost post-backup audit events |
| npm run test:browser / browser-final.json | FAIL 11/12, 0 skipped | Existing 180-second accessibility sweep timed out; new ready/cancel and other 10 tests passed |
| Automated accessibility in browser run | 55 scans, 0 reported violations | Interrupted sweep plus manual checks prevent conformance certification |
| npm run ops:evaluate / evaluation-final.json | PASS 12/12 | Deterministic local fixtures, model provider BLOCKED |
| npm run verify:public-target / public-target-final.log | PASS | Canonical entry-file boundary only; no deployment |
| typecheck, lint, production build | BLOCKED / script unavailable | package.json defines no separate scripts; no invented substitute |
| Hosted/staging and live providers | BLOCKED / not executed | Required environment, full async parity and authorizations absent |

The final resumed verification and final five-repeat performance series are recorded in the completion section after execution.

## Completed resumed verification

npm run verify completed with exit 0: **399 passed, 0 failed, 0 skipped**, duration 155972.2548 ms. Automated IP scan passed (human review still required), and site structure check passed for four pages. Evidence: verify-resumed.log and verify-resumed-exit.txt. This run includes the milestone/shipment failure-injection rollback regression. The earlier failure and interrupted attempt remain historical evidence.

Final performance series: **LOCAL_REPEAT_FAIL, 4/5 PASS**, document throughput failed once; original budgets unchanged. evidence/final-series/assessment.json covers all five. Aggregate validator returned ACCESSIBILITY_GATE, local/hosted NO-GO; all gate inputs are copied byte-for-byte under evidence/aggregate/. No CLI certification rerun is implied: the existing createCertification/validateCertification functions consumed actual retained command results.
