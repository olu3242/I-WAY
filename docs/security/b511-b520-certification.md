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
