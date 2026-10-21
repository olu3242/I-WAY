# B511–B520 certification register

Production NO-GO. Real tester onboarding NOT AUTHORIZED. Public website untouched.
Baseline: 82ecb58b832ebecbab6126873302fb8ffce6abab; cited prior evidence afec06565a18ca281ffa4c60730002440229c763.

## B511 — live catalog discovery
Objective: independently inspect metadata before reconciling DDL.
Implementation completed: expanded read-only inventory for defaults, dependencies, effective rights and migration versions; inspected branch/current code and previous evidence.
Files changed: db/review-only/iway_auth_catalog_b498.sql; this report.
Tests passed / failed / skipped: catalog hosted execution BLOCKED before SQL; baseline CI four workflows PASS at 82ecb58 (39588766561, 39588766535, 39588766526, 39588766546).
PostgreSQL verification: pending isolated compatibility fixture; no hosted catalog results.
GitHub CI: baseline PASS; batch commit recorded in Git history/final receipt.
Commit SHA: see final receipt.
Hosted verification: authorized Supabase CLI read-only catalog attempt returned HTTP 403: account lacks endpoint privileges. No privileged retry or alternate credentials. Supabase/Vercel plugins currently unconnected; Vercel CLI is authenticated.
Security findings: B460 unconditionally replaces two FKs and five policies; treats constraint names as semantics; new authority columns default deny and must not imply approved legacy grants.
Outstanding blockers: restore authorized read-only access to project vnoxdinldneeczxibicp. Live column/key/policy/migration values remain UNKNOWN, not inferred from B446 SQL.
Next execution: implement review-only compatibility correction and prove data/key/policy preservation on known repository fixtures.
Release decision: NO-GO.

### Compatibility matrix (live status is UNKNOWN for every operation)
| Proposed operation | Repository expectation / assessment | Correction / gate |
| --- | --- | --- |
| Create private schema | B446 defines existing schema | Preserve owner; verify client isolation before grants |
| Create PKCE table | Reported absent, not independently verified | Create only if absent; check existing type/key/policy/constraints |
| Add consumed_at / nullable verifier | Required for erased consumed metadata | Additive; existing incompatible type fails |
| Create session table | Reported absent, not independently verified | Validate actual PK/FK and token columns |
| Add expiry/refresh/version columns | Needed for atomic refresh | Additive, no type conversions; stale expiry revocation explicitly recorded |
| Replace session user FK | Unnecessary when compatible | Preserve equivalent restrictive FK regardless of name; reject unsafe variants |
| Create tenants | New deny-default projection | Never auto-activate from old role rows |
| Create tenant roles | B446 composite PK, role enum, CASCADE user FK | Preserve records, composite PK and existing CASCADE or RESTRICT semantics |
| Add active/permissions/principal/fleet | Missing from B446 | Add deny-default fields; require explicit approved grants/relationship mapping |
| Replace role user FK | Changes existing deletion semantics | Remove replacement; verify target/columns/action, preserve OID |
| Create resources | Private trusted projection | Restrictive tenant FK; no runtime provisioning writes |
| Create expiry indexes | New indexes only | Verify index column shape and validity on repeat |
| Enable/FORCE RLS | Reported already enabled on roles | Never disable; preserve existing compatible policies |
| ACL changes | Dedicated runtime, no clients | No unrelated table grants; fail on effective privilege drift |
| Drop/recreate policies | Loses active policy identity | Create missing policies only; validate exact existing runtime policy; unknown policies stop before mutation |
| Session cleanup UPDATE | Erases unverifiable legacy tokens | Explicit legacy session invalidation, never role-record mutation |

Unknown live constraints, triggers, dependencies and ACLs block hosted approval even when fixtures pass. The historical B446 script is a fixture contract, not a live schema dump.

## B512
Objective: Non-destructive migration remediation.
Implementation completed: Added review-only successor B512; preserves equivalent FK and policy OIDs, recognizes B446 CASCADE without changing it, rejects unsafe FK semantics, policy drift, index collisions and unsupported required columns. Preflight/postflight SQL and repeatability verified.
Files changed: db/review-only/iway_private_auth_sessions_b512.sql; iway_auth_preflight_b512.sql; iway_auth_postflight_b512.sql; tests/local/operations-auth-postgres.test.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; full repository 765 / 0 / 0 (shared validation run).
PostgreSQL verification: 15 / 0 / 0 on fresh PostgreSQL 18 TLS fixture; PostgreSQL 16 CI pending. No hosted migration applied.
GitHub CI: pending batch commit; final receipt records exact run IDs.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED by catalog 403 and unapproved administrative writes.
Security findings: unknown live constraints/policies still stop approval. Legacy role rows remain unchanged; newly added runtime grant fields deny access until separately approved.
Outstanding blockers: authorized live catalog, reviewed checksum, role/credential and migration approval.
Next execution: configuration/package checks then hosted gate assessment.
Release decision: NO-GO.

## B513
Objective: Restricted authentication runtime role.
Implementation completed: Prepared idempotent review-only role provisioning with no credential literal. Creates LOGIN with NULL password (unusable until approved credential provisioning); refuses elevated/membership/owner/public-CREATE drift. Startup rejects membership in either direction and unrelated table/column grants in all non-system schemas.
Files changed: db/review-only/iway_auth_role_b513.sql; server/operations-auth-database-check.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; full repository 765 / 0 / 0 (shared validation run).
PostgreSQL verification: 15 / 0 / 0 on fresh PostgreSQL 18 TLS fixture; PostgreSQL 16 CI pending. No hosted migration applied.
GitHub CI: pending batch commit; final receipt records exact run IDs.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED by catalog 403 and unapproved administrative writes.
Security findings: unknown live constraints/policies still stop approval. Legacy role rows remain unchanged; newly added runtime grant fields deny access until separately approved.
Outstanding blockers: authorized live catalog, reviewed checksum, role/credential and migration approval.
Next execution: configuration/package checks then hosted gate assessment.
Release decision: NO-GO.

## B514
Objective: Private session and PKCE persistence.
Implementation completed: Reused existing encrypted stores; no duplicate implementation. Switched existing real PostgreSQL integration to B512. Verified hashed handles, encrypted secrets, one-time consumption, concurrent refresh, logout races, retained erased metadata and fail-closed recovery. Added local runner reusing the existing disposable TLS cluster.
Files changed: tests/local/operations-auth-postgres.test.mjs; scripts/test-auth-postgres-isolated.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; full repository 765 / 0 / 0 (shared validation run).
PostgreSQL verification: 15 / 0 / 0 on fresh PostgreSQL 18 TLS fixture; PostgreSQL 16 CI pending. No hosted migration applied.
GitHub CI: pending batch commit; final receipt records exact run IDs.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED by catalog 403 and unapproved administrative writes.
Security findings: unknown live constraints/policies still stop approval. Legacy role rows remain unchanged; newly added runtime grant fields deny access until separately approved.
Outstanding blockers: authorized live catalog, reviewed checksum, role/credential and migration approval.
Next execution: configuration/package checks then hosted gate assessment.
Release decision: NO-GO.

## B515
Objective: Tenant authorization harmonization.
Implementation completed: Preserved carrier/fleet/driver/platform and original composite PK/check/FK. No automatic membership activation or inferred permission mapping. Existing cross-tenant, fleet, driver ownership and platform scope tests execute under restricted PostgreSQL. Added data/key/policy preservation assertions and alternate-schema privilege negatives.
Files changed: tests/local/operations-auth-postgres.test.mjs; server/operations-auth-database-check.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; full repository 765 / 0 / 0 (shared validation run).
PostgreSQL verification: 15 / 0 / 0 on fresh PostgreSQL 18 TLS fixture; PostgreSQL 16 CI pending. No hosted migration applied.
GitHub CI: pending batch commit; final receipt records exact run IDs.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED by catalog 403 and unapproved administrative writes.
Security findings: unknown live constraints/policies still stop approval. Legacy role rows remain unchanged; newly added runtime grant fields deny access until separately approved.
Outstanding blockers: authorized live catalog, reviewed checksum, role/credential and migration approval.
Next execution: configuration/package checks then hosted gate assessment.
Release decision: NO-GO.

### Migration rollback and forward recovery
B460 remains historical/review-only; B512 is the new candidate, not a claim of live compatibility. Preflight executes before DDL within bounded transaction/lock deadlines. Any incompatible object aborts; ROLLBACK restores prior state. Existing compatible FKs/policies retain their OIDs; unknown policies are not dropped. Existing role rows are never UPDATEd or DELETEd. New stable defaults avoid data conversion; any live lock/scan impact still requires catalog/size review.

Legacy sessions without verified provider expiry are explicitly revoked and encrypted token fields erased; this is irreversible secret erasure, already present in B490, and requires reauthentication. Do not restore erased tokens. After a committed staging change, disable authentication and restore only a proven schema-compatible application candidate; retain new tables and audit metadata. No destructive down migration, role deletion, or policy replacement is provided. Forward repair requires new reviewed SQL and a fresh restricted-role readiness check. Hosted rollback is NOT RUN because there is no deployment candidate.

PostgreSQL 18 exposes NOT NULL constraints in pg_constraint and can report restrict_violation (23001) rather than foreign_key_violation (23503). Fixture assertions now compare original PK/FK/CHECK OIDs and accept either specific integrity violation for the denied user deletion. No authorization expectation was relaxed.

## B516
Objective: Hosted configuration readiness.
Implementation completed: Read-only Vercel metadata reconfirmed exact project/team, Node24, all-deployment protection, verified domain, zero deployments and three preview variable names. Added metadata-only readiness assessor with negative tests. Pinned runtime to exact project and new b512-v4 schema marker; no hosted flags or secret values changed.
Files changed: scripts/auth-staging-readiness.mjs; server/operations-auth-runtime.mjs; tests/operations-auth-readiness.test.mjs; docs/security/b516-staging-metadata.json; docs/security/b516-readiness.json.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; repository 765 / 0 / 0 before final receipt; package build PASS.
PostgreSQL verification: 16 / 0 / 0 including real restricted-role HTTP, encryption, RLS, rotation and recovery checks.
GitHub CI: foundation eda3917670ad72c7164fc3133dd796d355982467 passed Verify39683556764, Auth lifecycle39683556603, B39139683556668, Identity39683556686; final changes pending.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED: six missing variable names, secret provisioning, catalog/schema/runtime verification and provider callback approval.
Security findings: neither metadata nor a local build proves a serving callback or successful provider authentication. Readiness outputs contain no secret values.
Outstanding blockers: see issue register and explicit authorization steps below.
Next execution: final regressions, exact-commit CI and certification report.
Release decision: NO-GO.

## B517
Objective: Isolated application package and build.
Implementation completed: Extended existing packager with adjacent non-served source manifest containing commit, dirty-source marker, exact packaged-file hashes and staging project. Actual standalone Vercel CLI54.2.0 build passed; emitted function/runtime/routes/static boundary/certificate verified. No deployment.
Files changed: scripts/package-auth-staging.mjs; tests/operations-auth-runtime.test.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; repository 765 / 0 / 0 before final receipt; package build PASS.
PostgreSQL verification: 16 / 0 / 0 including real restricted-role HTTP, encryption, RLS, rotation and recovery checks.
GitHub CI: foundation eda3917670ad72c7164fc3133dd796d355982467 passed Verify39683556764, Auth lifecycle39683556603, B39139683556668, Identity39683556686; final changes pending.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED: readiness and explicit preview deployment authorization absent; no hosted endpoint/callback claim.
Security findings: neither metadata nor a local build proves a serving callback or successful provider authentication. Readiness outputs contain no secret values.
Outstanding blockers: see issue register and explicit authorization steps below.
Next execution: final regressions, exact-commit CI and certification report.
Release decision: NO-GO.

## B518
Objective: Hosted lifecycle gates.
Implementation completed: Extended existing hosted verifier to require a deployment ID, current schema approval and provider approval before browser launch; records deployment ID in sanitized evidence. Positive/negative gate tests passed; real Supabase login was not run.
Files changed: scripts/verify-hosted-auth.mjs; tests/operations-auth-hosted-gates.test.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; repository 765 / 0 / 0 before final receipt; package build PASS.
PostgreSQL verification: 16 / 0 / 0 including real restricted-role HTTP, encryption, RLS, rotation and recovery checks.
GitHub CI: foundation eda3917670ad72c7164fc3133dd796d355982467 passed Verify39683556764, Auth lifecycle39683556603, B39139683556668, Identity39683556686; final changes pending.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED: no deployment, approved synthetic provider identities or provider callback configuration.
Security findings: neither metadata nor a local build proves a serving callback or successful provider authentication. Readiness outputs contain no secret values.
Outstanding blockers: see issue register and explicit authorization steps below.
Next execution: final regressions, exact-commit CI and certification report.
Release decision: NO-GO.

## B519
Objective: Recovery, workload and rollback evidence.
Implementation completed: Extended restricted PostgreSQL suite with a real blocking table lock: statement timeout denies authorization, release restores access. Measured 20 local authorization reads at concurrency4 with zero errors. Reused existing provider/storage/refresh/restart/expiry/revocation failure tests. No deployed fault injection or rollback attempted.
Files changed: tests/local/operations-auth-postgres.test.mjs.
Tests passed / failed / skipped: focused authentication 86 / 0 / 0; repository 765 / 0 / 0 before final receipt; package build PASS.
PostgreSQL verification: 16 / 0 / 0 including real restricted-role HTTP, encryption, RLS, rotation and recovery checks.
GitHub CI: foundation eda3917670ad72c7164fc3133dd796d355982467 passed Verify39683556764, Auth lifecycle39683556603, B39139683556668, Identity39683556686; final changes pending.
Commit SHA: final receipt / Git history.
Hosted verification: BLOCKED: no protected staging deployment and no known-good rollback candidate.
Security findings: neither metadata nor a local build proves a serving callback or successful provider authentication. Readiness outputs contain no secret values.
Outstanding blockers: see issue register and explicit authorization steps below.
Next execution: final regressions, exact-commit CI and certification report.
Release decision: NO-GO.

### B519 measured local workload (not a staging baseline or capacity claim)
PostgreSQL18/TLS on this workstation, 20 read authorizations, concurrency4: 13.429ms aggregate; p50 1.452ms, p95 6.028ms, 0 errors, observed 1489.31 requests/s over this tiny run. This workload is too small for sizing/SLA conclusions. Controlled authorization timeout took about two seconds and then recovered. Exact output retained in local dist/b511-evidence/auth-pg-final.log. CI repeats correctness, not a numeric threshold. Hosted database connection loss/restoration, provider fault injection, application restart, load, and rollback remain NOT RUN.

## Issue register
| ID | Severity | Root cause | Remediation / evidence | Status |
| --- | --- | --- | --- | --- |
| B511-01 | Critical | Catalog endpoint returns403 | Restore authorized project read access; no catalog rows obtained | BLOCKED |
| B512-01 | High | B460 replaced FK/policies by name | New migration preserves equivalent OIDs and known B446 data; local PG18 and CI PG16 pass | Repository fixed; hosted unverified |
| B513-01 | High | Effective roles/other schemas could escape narrow privilege inventory | Bidirectional membership and all non-system schema checks plus negative tests | PostgreSQL-tested |
| B515-01 | Critical | Unknown live tenant/principal/fleet mapping | Explicit approved mapping required; new columns remain deny-default | BLOCKED |
| B516-01 | Critical | Missing restricted DB/key/provider/approval configuration | Names-only inspection; secret-manager administrative workflow required | BLOCKED |
| B516-02 | High | Runtime accepted arbitrary matching Vercel project IDs | Pinned exact isolated project; negative test | Unit-tested |
| B517-01 | High | Package lacked exact source manifest | Non-served manifest with dirty marker and per-file hashes | Build-tested |
| B518-01 | Critical | No real provider/deployment evidence | Hardened runner gates; do not substitute local signed identities | BLOCKED |
| B519-01 | Critical | No rollback candidate or deployed recovery measurements | Local timeout/storage recovery executed; staging candidate needed | BLOCKED |

## Administrative sequence required to unblock hosted work
1. Restore authorized read-only catalog access for vnoxdinldneeczxibicp. Execute B511 catalog inventory and review live differences against every DDL matrix row, including early_access_leads isolation. Do not infer live state from fixtures.
2. Approve exact B513 role script and B512 migration checksums against that catalog; establish restricted SCRAM credentials through the secret manager and validate effective rights independently. No credentials in chat or repository.
3. Approve explicit tenant/principal/fleet/driver mapping and synthetic identities only. Existing B446 membership rows do not automatically become active runtime grants.
4. Approve supported Supabase OAuth provider and exact HTTPS callback allowlist, and configure missing preview-only secret/nonsecret values. Set b512-v4 schema approval and auth-enabled only after corresponding checks pass.
5. Authorize the protected preview from the exact clean CI-passing commit. Verify project ID, SSO enforcement, assigned hostname and real HTTPS route behavior before invoking the hosted verifier.
6. Approve bounded staging-only fault injection and workload, identify and test a known-good rollback candidate, then independently evaluate B520. Production and real tester onboarding remain unauthorized.

References consulted: PostgreSQL ALTER TABLE https://www.postgresql.org/docs/current/sql-altertable.html and Supabase RLS https://supabase.com/docs/guides/database/postgres/row-level-security . Grants, RLS and server resource policy remain separate requirements.
