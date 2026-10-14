# I-way Wave 0 — Repository Reconciliation

Status: **BLOCKED for R0 release; audit baseline established**  
Date: 2026-10-11  
Baseline: GitHub `main` tree inspected; only `README.md` exists.

## Evidence and limits

The current GitHub repository does not contain the previously reported React/Vite app, fleet authorization policy, CI workflow, public website, or test suite. Those items are **not certified** and must not be described as deployed or implemented.

The supplied project documents specify:
- R0 public website, early-access intake, brand assets, public/private isolation and human IP review.
- R1 carrier and driver onboarding, tenant/relationship authorization, dispatch, mobile execution, signed BOL/POD, notifications and audit.
- R2 invoicing, factoring, settlement, escrow and payment tracking.
- R3 managed-fleet operations and two-layer settlements.
- R4 full platform administration.
- Proposed architecture and vendor choices remain subject to ADRs.

## Batches 01–10: reconciliation and release foundation

| Batch | Work | Evidence required | Status |
|---|---|---|---|
| 01 | Inspect remote tree and baseline | GitHub tree and README | PASS |
| 02 | Recover canonical source and assets | Source inventory, checksums | BLOCKED: full source archive not in repository |
| 03 | Reconcile uploaded pages/assets with existing code | File-by-file conflict matrix | PENDING |
| 04 | Create isolated public build | Only `site/public` deployable | PENDING |
| 05 | Restore official brand kit | SVG assets and tokens, visual check | PENDING |
| 06 | Restore public navigation, early access, legal pages | Functional browser tests | PENDING |
| 07 | Connect live early-access backend | HTTPS validation, spam control, persistence, failure tests | PENDING |
| 08 | Run static/a11y/performance and IP gates | `npm run verify`, Lighthouse/axe, manual review | PENDING |
| 09 | ADRs for API, database, mobile, tenancy and orchestration | Reviewed ADRs | PENDING |
| 10 | Produce R1 traceability backlog | PRD IDs → implementation → tests | PENDING |

## Non-negotiable controls

1. Do not deploy `docs/`, `reference/`, internal algorithms, private architecture or secrets.
2. Never deploy the Figma Make prototype as production.
3. Every R1 request must authorize role, permission, tenant, relationship and resource ownership.
4. Human approval is mandatory for financial transactions; all status-changing actions must be audited.
5. No production-ready claims without passing tests, deployment evidence and sign-offs.

## Go / No-Go

**NO-GO for public launch.** The codebase is missing, live lead capture is not certified, and legal/IP/a11y reviews are not signed.

## Next action

Import the complete canonical R0 source package and brand assets on this branch, run the build and verify gates, and open a reviewed PR before merging. Keep internal documents private and outside the deploy artifact.
