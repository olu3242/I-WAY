# I-WAY B902–B1000 — certification evidence

Local tested contracts: **GO**. Full managed disaster recovery: **NOT CERTIFIED**. Hosted UAT and Production: **NO-GO**.

Starting commit: cf6fdbf7c675059596633fbcc7237df7c04af505. Branch: work/b902-b1000-recovery-v2-20261029. PR #24 is the baseline. The final exact commit, publication/CI and artifact binding are recorded in dist/b902-b1000/post-commit-verification.json. The two original untracked files remain unchanged and uncommitted; the whole worktree is therefore not clean.

## Work completed

| Batch | Disposition | Evidence/work |
|---|---|---|
| B902–B920 | PASS_LOCAL_LAB / BLOCKED_FULL_MANAGED_PARITY | Separate pinned V2, actual health/loopback, managed catalog and COPY comparison |
| B921–B940 | PASS_LOGICAL_RESTORE / BLOCKED_FULL_DISASTER_RECOVERY | Original backups/hash checks, 31 empty COPY counts, FK validation, transaction rollback; prior 3+5 forward recovery preserved |
| B941–B950 | PASS_LOCAL_MIGRATIONS / BLOCKED_FRESH_HOSTED_DRY_RUN | Eight exact migrations on restored 17.11; guarded fresh CLI 403; no hosted migration applied |
| B951–B960 | PASS_LOCAL_INTEGRATION / BLOCKED_HOSTED_ACTIVATION | Approved project source pins, strict TLS probe, combined four-schema chain; separate management/storage/provider gates |
| B961–B970 | PASS_LOCAL_PROTOCOL_AND_FIXTURES / BLOCKED_HOSTED_AUTH | Actual local GoTrue password/refresh/TOTP/logout; synthetic application role/session tests; real roster mapping remains unverified |
| B971–B980 | PASS_COVERED_LOCAL_WORKFLOWS / BLOCKED_HOSTED_E2E | Four-persona logistics/finance/offline/governance/feedback/navigation regression; no new unsupported product rules |
| B981–B990 | PASS_LOCAL_REGRESSION_WITH_LIMITATIONS | Repository, PostgreSQL, browser, axe, security, performance, recovery; human AT NOT RUN |
| B991–B1000 | APPROVAL_READY_CANDIDATE / HOSTED_NO_GO | Consolidated artifacts, risks, runbook, exact SQL/configuration approval package; no production/public mutation |

Implemented V2 provisioning and target guards, managed catalog comparison, original backup integrity checks and transactional restoration, real restricted-login/RLS assertions, local GoTrue protocol testing, and an exact-target dry-run guard. Corrected the active application's public-project pins and a connection probe that could pass without verified client TLS or complete role evidence. Existing functionality and authorization remain preserved.

## Final fresh results

| Suite | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Repository | 1007 | 0 | 0 |
| General Chromium | 187 | 0 | 0 |
| Durable PostgreSQL browser | 75 | 0 | 0 |
| Existing PostgreSQL 17.11 leaf scenarios | 108 | 0 | 0 |
| Additional combined-schema leaf scenarios | 5 | 0 | 0 |

The existing PostgreSQL suite reports 118 Node checks including ten orchestration parents. The additional chain reports 6 checks including one parent. Browser and repository totals remain separate. Targeted subsets overlap the full repository suite and are not added again.

Additional local assertions: eight migration files on restored Supabase PostgreSQL 17.11, 9 database/recovery checks, and 22 checks against actual local GoTrue. All 31 original COPY sections reconcile to zero rows because this backup is empty. Runtime assertions authenticate as the restricted identity, including wrong-password, cross-tenant and unauthorized-write denials. Administrator connections are used only for local restore/setup.

Axe: 425 scans, 0 violations. Human screen-reader, native-dialog, zoom and touch checks remain NOT RUN: 48 scripts plus three feedback tasks. Four real-user acceptance records also remain NOT RUN. These scans do not establish full WCAG conformance.

Covered controls: 87/87 actions, 41/41 forms, 64/64 button labels and 26/26 navigation entries; zero executable control gaps. Of 155 inventoried fields, 119 were interacted with. Not all permutations are certified. The 74 route patterns are an inventory, not proof of every HTTP method and identifier.

Performance smoke: PASS against the unchanged baseline. SQLite recovery rehearsal: PASS, with observed local RTO 478.2330999999999 ms and RPO 706 ms. These are not hosted objectives. The logical backup restore command took 6392 ms; that duration is not a full-platform RTO. Dependency audit: 0 vulnerabilities. Scoped secret review: PASS. No configured private values were printed or committed.

Earlier parser, role, harness and gateway failures were corrected; diagnostics remain available. The legacy SET-role harness was replaced by actual restricted-login assertions. The prior unchanged 3+5 forward-migration recovery evidence was preserved; it is not presented as a fresh hosted exercise.

## Hosted state and remaining work

Read-only UAT observations confirm PostgreSQL 17.11, a healthy project, initially zero Auth users, and no application tables or migration history. At final inspection there are two unconfirmed email users and zero verified MFA factors; application schemas/history remain absent. These users appeared independently of this execution and their approved roster mappings are unverified. The original empty backup does not cover these new records. Public JWKS retrieval succeeds. The CLI's current project list does not include UAT, and the fresh guarded dry-run returns HTTP 403 at the login-role endpoint. Authenticate the correct owner-approved CLI account/profile privately; do not broaden application privileges.

All 13 required Preview names exist; secret values were not requested for decryption or certified; only names/scopes were retained. Preview still contains the service-role key name and needs owner-approved cleanup. Full managed parity remains blocked by Storage schema differences. Storage object bytes, provider/delivery/signing configuration and populated account restoration remain unverified.

All 95 hosted application cases remain BLOCKED, with zero executed. Real Google callbacks, hosted password/reset/MFA/session lifecycle, roster UUIDs and relationships, and protected external entry remain uncertified. This execution made no hosted migration, account, invitation, access, settings, Production or public-waitlist change.

Figma functionality, visual conformity and complete API integration percentages are **not measured**. Original approved Figma file/version/exports and a complete API requirement denominator are unavailable. Verified local control coverage is reported separately.

## Operator handoff

See [activation-package.md](activation-package.md), [recovery-runbook.md](recovery-runbook.md), [risk-register.json](risk-register.json), [hosted-uat-results.json](hosted-uat-results.json), [receipt.json](receipt.json) and [changed-files.json](changed-files.json).

The smallest next owner action is to authenticate an approved CLI account/profile that can see UAT and complete a fresh guarded read-only dry-run. In parallel, the recovery owner must approve a supported managed restore strategy, operator and RPO/RTO. Then request the exact migration/dependency approvals. Activation and tester provisioning remain separately gated.
