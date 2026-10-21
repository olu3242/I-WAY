# B498–B510 certification register

Production: **NO-GO**. Baseline afec06565a18ca281ffa4c60730002440229c763. No production release, hosted migration, tester invitation or application deployment is authorized by a passing fixture.

## B498–B499: schema compatibility and effective privileges

Authorized read-only catalog query on vnoxdinldneeczxibicp was denied by Supabase MCP (-32600). Project metadata lookup was also denied. No alternate privileged connection was attempted. The prompt's reported missing tables and region cannot be independently reconfirmed. Live schema compatibility remains blocked.

Repository correction: review SQL now validates existing column types and required fields, primary keys, resource foreign key, unexpected foreign keys, triggers and policies before mutation; rejects inherited runtime role memberships; uses bounded DDL/lock deadlines. Runtime startup checks effective column/table grants, client schema access, role attributes/memberships, actual columns, policy expressions, PK/FK retention contracts and unrelated table access. Unknown structures fail closed for administrative review. This draft is not an approved migration.

Files: db/review-only/iway_private_auth_sessions_b460.sql; db/review-only/iway_auth_catalog_b498.sql; server/operations-auth-schema-contract.mjs; server/operations-auth-database-check.mjs; server/operations-auth-runtime.mjs; tests/operations-auth-runtime.test.mjs; tests/local/operations-auth-postgres.test.mjs.

Tests: focused 82 passed / 0 failed / 0 skipped; full 761 / 0 / 0 before remote CI. Expanded real PostgreSQL compatibility/privilege drift cases await CI. Commit and CI receipts will be recorded after execution.

Administrative workflow required: authorize read-only catalog inventory, review its metadata and migration history, provision the restricted role separately, review the exact SQL checksum against current catalog, approve staging migration, then validate with the restricted identity. No owner-role shortcut. Rollback before COMMIT is transactional; after commit disable auth and roll back application only to a schema-compatible preview. Retain metadata and restrictive FKs; erased tokens cannot be restored and require reauthentication. No destructive down migration.

## B500: current staging inventory

Vercel team team_zNHlJbJHa4YZFwN4p9lcHzEH; project prj_7uof3CdmN1QvzKxETkXvHjlrLjVm / iway-auth-staging. Node 24.x, framework Other, root ., no Git deployment connection, no deployments, protection enabled for all deployments. The project-domains API confirms iway-auth-staging.vercel.app verified=true; the project summary's empty domains array is not the domain inventory. HTTPS application serving/callback routing remain unverified.

Provisioned preview-only nonsecret configuration: IWAY_STAGING_VERCEL_PROJECT_ID, IWAY_AUTH_ORIGIN, IWAY_AUTH_ENABLED=false. No credentials, approved-origin flag or schema-approval flag were set. Required secrets must be entered directly in Vercel's secret manager by an authorized administrator; never in chat. No production variables changed.

## Open issue register

| ID | Severity | Root cause / remediation | Tests / hosted evidence | Status |
| --- | --- | --- | --- | --- |
| V3-01 | Critical | Private catalog access denied; restore authorized read-only access and review actual state | MCP denial; no live catalog evidence | BLOCKED |
| V3-02 | High | IF NOT EXISTS did not prove compatibility; add preflight and negative migration cases | Local suite pass; real PG CI pending | Repository implementation |
| V3-03 | High | Runtime previously omitted effective column grants/memberships/policy definitions | Real PG privilege drift cases added | Repository implementation |
| V3-04 | Critical | No restricted credentials/provider configuration | Preview metadata configured; auth disabled | BLOCKED |
| V3-05 | Critical | Hosted routes/login/isolation/recovery/rollback absent | No deployment or hosted execution | BLOCKED |

Next: validate real PostgreSQL CI, validate a Vercel local function build without credentials/deployment, add independently testable observability/recovery/fixture improvements, and record all blocked hosted gates explicitly.
