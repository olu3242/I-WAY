# I-WAY B821–B840 — E2E execution and UAT certification

Local decision: **GO for implemented, tested contracts only**. Hosted UAT and Production: **NO-GO**. Real-user acceptance is unperformed. Production deployment is prohibited in this task.

Starting SHA: `c5998b3ada6121ff7de91f81f71a5cba886f2f5b`. Branch: `work/b751-b770-harmonization-20261026`. [Draft PR #21](https://github.com/olu3242/I-WAY/pull/21) remains unmerged. The ending SHA, remote CI jobs, clean state and exact package hash are recorded after commit in `dist/b821-b840/post-commit-verification.json`; these results cannot truthfully be embedded before that commit exists.

## Implementation and baseline

Baseline receipt integrity: 22 raw artifact hashes and six accepted domain hashes match. The original dirty worktree's 136 preserved files are unchanged. PR verification for c5998b3 passed [Verify](https://github.com/olu3242/I-WAY/actions/runs/40516842419) and [Identity access certification](https://github.com/olu3242/I-WAY/actions/runs/40516842267). Both push and PR workflows are inspected in the raw CI record. Final candidate CI is checked separately after publication; local PASS is not remote CI PASS.

The principal new application behavior is [governed UAT feedback](feedback-contract.md): authenticated same-origin/CSRF API, current stored opt-in and base authority, privileged MFA, tenant/reporter/fleet boundaries, immutable IDs/UTC timestamps, structured metadata, active owner assignment, reviewed retest references, reporter acceptance, transactional events/audit, stable-key replay, stale-version checks, rate limit and rollback. Both application and governance pages use the shared accessible UI and durable PostgreSQL engine. Existing users receive no new grants. No operational permission catalog or financial policy was expanded.

The full regression found and corrected disabled-feedback native-login/live-region behavior and a serious mobile target-size violation. Test setup errors were also corrected: unregistered grants, schema status expectation, logout navigation synchronization and package fixture completeness. Original failures remain in ignored evidence; [the defect register](defects.json) separates product defects from harness corrections. No required check was disabled or weakened.

Candidate secret scan: PASS; 996 regular files, zero configured private-value matches. `.env.local` is ignored and untracked. This scan checks configured values and selected private formats, not a universal or historical secret-scanning guarantee. Dependency audit reports zero vulnerabilities.

## Actual final local results

| Suite | Passed | Failed | Skipped / scope |
|---|---:|---:|---|
| Repository verify | 989 | 0 | 0; source/build/IP/site gates PASS |
| Full Chromium browser | 186 | 0 | 0; frozen source |
| PostgreSQL browser | 74 | 0 | 0; disposable restricted PostgreSQL |
| PostgreSQL17.11 contracts | 108 leaf scenarios | 0 | 10 suites; 118 Node checks including parents |
| Local HTTP PostgreSQL restart/recovery | 1 | 0 | 0 |
| Supplemental PostgreSQL feedback/browser physical restart | 1 | 0 | 0; separate event/audit persistence check |
| New feedback unit/integration subset | 8 | 0 | Included in repository total |
| New feedback browser subset | 7 | 0 | Included in full browser total; six durable counterparts included in PG suite |
| Packaging subset | 8 | 0 | Included in repository total |
| Real hosted UAT | 0 | 0 | 94 BLOCKED; zero executed |
| Human acceptance | 0 | 0 | Four personas NOT RUN |

The two browser suites overlap; do not add them as unique product scenarios. Unit/packaging/security subsets overlap repository totals. PostgreSQL orchestration parents are excluded from leaf counts. The test named “hosted HTTP logistics” runs on isolated loopback and is local evidence.

Axe evidence: **423 primary + 1 supplemental physical-restart = 424 scans, 0 violations**. Other repeated targeted runs are excluded. [48 manual scripts](manual-accessibility.json) and three feedback tasks remain NOT RUN. Chromium automation and viewport/touch emulation are not human screen-reader, full cross-browser or WCAG conformance certification.

Primary executable controls with explicit verified outcomes: 87/87 actions, 41/41 forms, 64/64 button labels, 26/26 navigation entries. Field permutations, disclosure/manual-dialog behavior and all dynamic API methods/IDs are separate coverage limitations. Route inventory contains 74 patterns, not an API integration percentage. The new API is tested with authenticated durable writes and negative outcomes; no live-provider integration percentage is claimed.

Existing 35 prototype root mappings, 27 current mapped surfaces and 390/768/1440 captures remain source-bound; the four feedback persona captures supplement them. Full functional and visual Figma percentages remain **null / NOT CERTIFIED** because original approved exports/version are unavailable. The prototype is a flow reference; Brand Kit styling remains authoritative.

## Batch status

| Item | Status | Certified scope / remaining boundary |
|---|---|---|
| B821 | PASS | local and baseline CI: Prior 22 evidence hashes and six protected domains verified; c5998b3 PR Verify and Identity CI pass. New final-SHA CI is recorded post-commit. |
| B822 | BLOCKED | real-user authentication: No approved exclusive staging database or target-specific canonical identities/MFA/relationships/delivery. Local synthetic provider/session tests pass; real account absence is not assumed. |
| B823 | PASS | implemented local screens: Existing screens preserved; feedback opt-in, loading/error states, disabled native-login behavior, spacing and mobile touch targets corrected. |
| B824 | PASS | implemented local first-value journeys: Carrier/Driver first-load guidance, Fleet onboarding/resources/pay and Platform governance/owner-profile regressions pass; real-user acceptance is unperformed. |
| B825 | PASS | local governed feedback: New authenticated, durable, tenant/reporter-scoped feedback; structured diagnostics, ownership, audit, required retest evidence, closure, replay/rate/stale/rollback tests. Hosted opt-ins not granted. |
| B826 | PASS | current load contracts: Four-step wizard, drafts, stops, eligibility, dispatch/reassignment/rejection, cancellation, completion, stale/concurrent/retry and rollback regressions pass. Specialized equipment remains an approved-contract gap. |
| B827 | PASS | current local assignment orchestration: Carrier dispatch, Fleet ownership/employment and Driver acceptance/rejection preserve one owner, versions and idempotency. External notifications unavailable. |
| B828 | PASS | current offline execution: Bounded ordered offline replay, current assignment fences, receipt recovery and PostgreSQL restart tests pass. Live GPS/geofencing and sensitive capture are not certified. |
| B829 | BLOCKED | full document/compliance lifecycle: Current reviewed metadata, text documents, POD references, expiry eligibility and access-control tests pass. Sensitive uploads, identity packages, OCR/provider/storage/retention contracts remain blocked. |
| B830 | PASS | implemented local financial contracts: Integer-cent settlements, six driver-pay models, expenses, adjustments, source integrity, immutable approval/version and retry tests pass. No payment transfer or provider certification claimed. |
| B831 | PASS | current authorized command center: Persisted visible-load control-tower/approval/exception/resource metrics and role-filtered dashboard regressions pass. No global tenant totals added. |
| B832 | BLOCKED | requested seven named agents: Five existing bounded registry roles and governed job/retry/lease/human-approval tests pass. MAX/PULSE/CLARA/GUARDIAN/FINN/SAGE/ATLAS lack approved mappings; no new authorities or providers invented. |
| B833 | PASS | existing evidence-based rules: Scheduled missed milestones, current eligibility, open document/operational exceptions, advisory escalation and worker-health tests pass. Thresholds retained; no live GPS prediction or new autonomous resolution policy. |
| B834 | BLOCKED | external delivery: Existing local event notifications, preferences, deduplication, suppression and failure/retry contracts pass. Approved delivery provider/sender and operational owner remain unidentified. |
| B835 | PASS | tested local security contracts: MFA, signed identity, current membership/permission/ownership, RLS, CSRF, stale/revoked sessions, replay and tenant attacks pass. Candidate scan and dependency audit pass; hosted privileged-key policy unresolved. |
| B836 | PASS | local regression measurements only: Four existing lab workload budgets pass unchanged; 128 authenticated loopback PostgreSQL reads measured. No hosted capacity, rendering-latency, SLA or representative production volume certification. |
| B837 | PASS | isolated local recovery: Actual disposable PostgreSQL restart/write denial and stable-key retries pass; SQLite backup/restore rehearsal passes. Hosted backup owner, recovery target and restore objectives are blocked. |
| B838 | PASS | automated local accessibility: Primary full-suite axe scans pass with zero violations; responsive and keyboard regression passes. 48 human scripts and three feedback tasks are NOT RUN; Chromium only, no WCAG conformance claim. |
| B839 | BLOCKED | hosted execution: 94 hosted cases blocked, 0 executed. Database/secret-policy/identity/delivery/protection prerequisites prevent deployment; candidate deployment ID/URL null. |
| B840 | PASS | reviewed local release package: Consolidated source-bound evidence, risk/approval registers, exact changed-file manifest and local commit prepared. Final SHA/package/push/CI state is verified in the post-commit sidecar. |

## Performance and recovery

Unchanged four-worker/six-round lab budgets: **PASS**. Metrics below are actual local workload values, not hosted SLAs or production capacity. Worker peak RSS is process memory, not whole-host utilization. CPU/resource details are in the raw performance JSON.

| Workload | p50 ms | p95 ms | Operations/s | Peak worker RSS bytes | Unexpected errors |
|---|---:|---:|---:|---:|---:|
| dispatch | 1.3194000000000017 | 51.73339999999999 | 66.74386707291434 | 68509696 | 0 |
| workflow | 0.3912000000000262 | 128.82239999999996 | 159.31092713649235 | 68206592 | 0 |
| documents | 5.518799999999999 | 85.04100000000001 | 130.2377979393125 | 68444160 | 0 |
| tenant_isolation | 2.1739000000000033 | 57.90980000000002 | 218.6083031076988 | 68452352 | 0 |

Sequential authenticated loopback PostgreSQL measurements: MEASURED_LOCAL_ONLY; 128 document/read-API requests, four personas. Document timing excludes browser rendering and external network; no hosted latency budget was inferred. Resource cardinality is a synthetic assigned-load fixture, not a scale test.

| Persona | Operation | Samples | p50 ms | p95 ms | Failures |
|---|---|---:|---:|---:|---:|
| platform | authenticated_document_http | 16 | 15.165600000000268 | 79.40450000000055 | 0 |
| platform | authenticated_read_api | 16 | 16.403199999998833 | 21.015300000000934 | 0 |
| carrier | authenticated_document_http | 16 | 18.60689999999886 | 29.065300000000207 | 0 |
| carrier | authenticated_read_api | 16 | 19.8729000000003 | 30.23869999999988 | 0 |
| fleet | authenticated_document_http | 16 | 17.32140000000072 | 20.647800000000643 | 0 |
| fleet | authenticated_read_api | 16 | 16.231299999999464 | 24.33560000000034 | 0 |
| driver | authenticated_document_http | 16 | 14.70889999999963 | 19.887100000001737 | 0 |
| driver | authenticated_read_api | 16 | 14.782600000000457 | 17.15400000000045 | 0 |

SQLite recovery rehearsal: PASS; observed RTO **443.0257999999999 ms**, RPO **719 ms**. Deliberate post-snapshot loss/session-revocation assertions remain in `dist/b821-b840/recovery.json`. Disposable PostgreSQL restart proves local transaction/reconnect behavior. Supplemental feedback restart readback independently verifies the immutable audit count using the disposable management connection; this is separate from restricted application identity evidence. Hosted backups, restore permissions, recovery deployment and objectives remain unverified. [The runbook](operations-runbook.md) identifies responsibilities and feedback-compatible rollback.

## Hosted readiness and approval boundaries

Fresh names-only metadata: **13/13 required Preview names present**, values not certified. The application project has a `SUPABASE_SERVICE_ROLE_KEY` name in Preview and separately in Production. Preview policy remediation needs owner authorization; Production and the public early-access project are excluded. [The environment contract](environment-contract.json) contains names/scopes only. Existing runtime Preview/project/origin/TLS/restricted-role/schema gates remain unchanged.

No exclusive I-WAY staging database, authenticated management owner/connection or invitation provider/sender has been designated. The current target pins identify an expressly excluded public early-access project and require one consistent reviewed change after owner designation. Do not execute historical migrations against that project, replace just a database URL, impersonate restricted runtime with an administrator or relax the gates.

The approved four-email roster is preserved in [the acceptance manifest](four-persona-acceptance.json). Actual canonical subjects/UUIDs, native principals, tenant/fleet/employment assignments, MFA and individual feedback opt-ins are not verified. No real accounts, factors, invitations or access grants were created; empty manifest fields do not prove account absence.

Staging Git deployment creation remains disabled and SSO protects all deployments; the exact feature branch is also suppressed in the public project. The session's explicit approval permits reviewed feature-branch pushes for CI only. [A01–A12](approval-register.md) retains exact identifiers, targets, prerequisites, risk, verification and rollback. Conditional Preview execution remains blocked by the unresolved infrastructure/security gates. No candidate deployment ID/URL exists; READY for a different SHA/target is not certification.

Current team metadata confirms Hobby. Individually authorized external collaborators can use protected Preview access without team membership; Hobby permits one active collaborator, so the owner must approve serial grants, exact deployment, identities and revocation. No protection bypass or billing change is proposed. [Official Vercel sharing documentation](https://vercel.com/docs/deployments/sharing-deployments).

The [94-case hosted matrix](hosted-uat-results.json) preserves all 88 prior IDs and adds six feedback cases. Each is BLOCKED and unexecuted. Real Google/password/reset/MFA/session, cross-tenant, financial, recovery and operational acceptance remain uncertified.

## Remaining priorities and next execution

[Risk register](risk-register.json): designate the exclusive staging database/management owner and invitation provider first; then review consistent pins, target SQL, restricted credentials, Preview privileged-key cleanup, canonical hierarchy, human MFA, delivery and protected external entry. Final CI/archive verification and an approved compatible recovery target precede any genuine Preview deployment. Named agents, sensitive storage, live providers, original Figma evidence and human accessibility retain their explicit contract/reference boundaries.

Recommended B841–B860 sequence: database designation; management owner; consistent pins; target-specific migration review; restricted login/TLS; Preview secret policy; Google callbacks; canonical identity hierarchy; human MFA; delivery ownership; individual protected entry; exact artifact/CI gate; approved Preview deployment; real Google tests; password/reset tests; session/offline recovery; finance reconciliation; human accessibility; real feedback/retest acceptance; final release decision. These are next prerequisites, not actions executed in this batch.

The reviewed changed-file manifest and receipt accompany this report. Post-commit verification records ending SHA, source/blob checks, original-work preservation, package checksum, publication and final CI. **Hosted UAT NO-GO. Production NO-GO.**
