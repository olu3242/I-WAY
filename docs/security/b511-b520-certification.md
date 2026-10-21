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
