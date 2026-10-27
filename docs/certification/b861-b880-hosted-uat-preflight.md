# B861-B880 — Hosted UAT deployment preflight

## Verified target (2026-10-27)
- Dedicated UAT project: `zolwjyhbfsxbdwyiwkbt` (`I-WAY-UAT`, us-east-1, PostgreSQL 17.11, ACTIVE_HEALTHY).
- Read-only hosted SQL: `operations_private` and `iway_private` absent; `supabase_migrations.schema_migrations` absent.
- Supabase security advisors returned zero current findings. This is not a post-migration audit.
- Local source checks 12/12 PASS; eight migrations and behavioral tenant RLS suite PASS on disposable PostgreSQL 17.
- Public waitlist project `vnoxdinldneeczxibicp` is NOT a permitted deployment target.

## Required gates before any hosted write
1. From the isolated worktree, inspect `supabase status`, `supabase projects list`, and `supabase migration list --linked`; verify the linked project is **exactly** `zolwjyhbfsxbdwyiwkbt`.
2. Confirm the database owner approves the migration set and has a recoverable pre-deployment backup/PITR strategy. Record the approved rollback and recovery owner.
3. Run `supabase db push --help` to confirm flags for the installed CLI version, then `supabase db push --dry-run` from the isolated UAT worktree. Review every migration in order. Never execute from the root/public-linked repository.
4. Verify registration login role credentials are managed out of band, with no secrets in commits or logs; verify provisioning and runtime roles have only intended privileges.
5. Complete lifecycle tests for dispatcher create, activate, deactivate, and active-principal restrictions using actual non-owner roles. Existing tests prove directory projection, scoped reads/updates, upsert denial, and rollback but do not fully certify those lifecycle flows.
6. Obtain explicit hosted UAT deployment approval, then perform a reviewed UAT-only migration execution and independently verify schema, RLS, policies, role grants, and application behavior.
7. Run Supabase security advisors again after deployment, then test authenticated four-persona flows and tenant isolation through hosted application routes.

## Rollback posture
No hosted migration has been applied during B861-B880. Before the first write, document restore point, downtime allowance, migration transaction boundaries, and owner-approved recovery procedure. Do not assume a SQL down migration can safely reverse data-bearing DDL.

## Release decision
LOCAL TESTED CONTROLS: PASS. HOSTED UAT: NO-GO pending dry-run review, lifecycle tests, approval, deployment, and hosted certification. PUBLIC/PRODUCTION: unchanged.
