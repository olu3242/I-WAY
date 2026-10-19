# R1 Requirements and Evidence Register — 2026-10-19

Status: PARTIAL / NO-GO. This is a documentary baseline, not source certification.

## Provenance
- October 16 I-WAY MVP 2 stakeholder report (ChatGPT Library: I-WAY-MVP-2-Stakeholder-Status-2026-10-16.docx).
- October 15 operational certification console logs (ChatGPT Library: Pasted text(20261015-012322).txt).
- October 17 reported local checkpoint: work/mvp-remediation-20261017 at 32d9726 (source not available for verification).
- GitHub main confirmed at 4f5a3a6 (2026-10-14).
- This R1-R10 working branch was created from 4f5a3a6.

## Requirements-to-evidence inventory
| ID | Capability | Historical implementation evidence | Acceptance gap | Priority |
| --- | --- | --- | --- | --- |
| IW-01 | Platform Admin sessions/revocation | B300/B310 local workflow | Hosted identity, configuration, authorization E2E | High |
| IW-02 | Carrier dispatch and shipment | Core dispatch and PostgreSQL carrier extensions | Complete command/view and cross-persona coverage | Critical |
| IW-03 | Fleet assignment/equipment | Local core workflow | Full equipment/assignment parity | High |
| IW-04 | Driver completion/POD | Tracking and delivery evidence extensions | Offline, recovery, physical device acceptance | Critical |
| IW-05 | Documents and approvals | PostgreSQL command subset | Lifecycle and cross-persona acceptance | High |
| IW-06 | Invoicing/payments | PostgreSQL command subset | Settlement/provider integration and authorization | High |
| IW-07 | PostgreSQL parity | 39/72 command paths at B310 (54.2%) | Recount latest source; 33 missing at historical checkpoint | Critical |
| IW-08 | Accessibility | B310 12 automated scans/0 violations | Human review and cross-platform validators | High |
| IW-09 | Performance | B310 192 requests/0 errors; Oct17 tracking regression reported | Approved SLO, repeatable profiling, regression fix | Critical |
| IW-10 | Agentic runtime | Oct17 report of MAX/PULSE/CLARA/GUARDIAN/FINN/SAGE/ATLAS | Verify source, durable jobs, real handoffs and live-model consent | Critical |
| IW-11 | Hosted release | Earlier local PARTIAL, hosted NO-GO | Hosted access, credentials, fixtures, recovery, approvals | Critical |
| IW-12 | Integration | Remote main 4f5a3a6 | Recover and verify Oct17 32d9726; reconcile branches and PRs | Critical |

## Measurement rules
- 39/72 is B310 PostgreSQL command coverage ONLY, not overall MVP completion.
- Application, PostgreSQL and browser suites may overlap; do not sum counts as unique tests.
- Oct17 reported test results and agent claims are not independently reproduced on this branch.
- Do not claim QA readiness, live-model validation, deployment, or certification from documentary evidence.

## R1 completion checklist
- [x] Identify historical stakeholder baseline and local evidence records.
- [x] Verify remote main commit and create isolated R1-R10 working branch.
- [x] Build initial requirements-to-evidence register.
- [ ] Locate 32d9726 archive/source and verify SHA-256 b0793656bfb4d301c84071c15d80251cc4f90ebe33c257d9b8e711f4b7d631bc.
- [ ] Verify reported 736-file source inventory against archive.
- [ ] Diff source against remote main and PRs.
- [ ] Establish approved weighted MVP scope and acceptance denominator.
- [ ] Execute fresh tests on consolidated candidate.

## R2-R10 release dependencies
1. R1 source recovery before definitive reconciliation.
2. R2 integration before definitive merged-tree performance and regression results.
3. R3 tracking diagnosis before R4 remediation.
4. R5-R7 runtime, persistence, browser, device and accessibility gates.
5. R8 approved consent, provider and hosted access; fail closed if unavailable.
6. R9 independent evidence review and certification.
7. R10 branch protection, required CI checks, independent review and explicit merge/deploy authorization.

Release decision: NO-GO.
