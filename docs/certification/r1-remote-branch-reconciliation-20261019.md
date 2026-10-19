# R1 Remote Branch Reconciliation Inventory — 2026-10-19

Read-only GitHub compare against main at 4f5a3a6. Counts are GitHub commit ancestry, not a measurement of missing features or source completeness.

| Branch | Compare status | Ahead | Behind | Changed files | Assessment |
| --- | --- | ---: | ---: | ---: | --- |
| feat/ai-native-decision-plane | behind | 0 | 145 | 0 | Already in main ancestry; no branch delta to merge |
| integration/iway-full-consolidation-20261013 | diverged | 2 | 258 | 2 | Reconcile ledger and preflight separately |
| feat/iway-qa-persona-security-20261014 | ahead | 12 | 0 | 12 | Candidate QA security functionality; review/test before merge |
| feat/iway-qa-persona-switch-policy-20261014 | diverged | 6 | 258 | 6 | Separate QA session-policy candidate; potential overlap |
| feat/fcc-03-driver-offline-reconciliation | behind | 0 | 325 | 0 | Already in main ancestry |
| work/b244-b253-certification-remediation-remote | behind | 0 | 90 | 0 | Already in main ancestry |

## R2 reconciliation decisions
1. Do not cherry-pick already-ancestral branches; verify features in current main instead.
2. Review both QA persona branches for overlapping policy logic and choose a single fail-closed implementation after tests.
3. Inspect consolidation preflight and ledger changes independently.
4. Recover missing local 32d9726 source before asserting complete integration.
5. Preserve explicit consent and production NO-GO until hosted and independent review gates pass.

## Current baseline
- main: 4f5a3a6bd82aa3d220ded562fd3f777ddb738b51.
- Working branch: work/iway-r1-r10-consolidated-certification-20261019.
- package.json includes verify, browser, PostgreSQL, benchmark, recovery, evaluation, certification and release validation scripts.
- No runtime tests or source import performed in this inventory.
