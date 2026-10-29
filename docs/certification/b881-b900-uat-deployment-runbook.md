# I-WAY B881-B900 — UAT deployment runbook and evidence

**Target:** I-WAY-UAT `zolwjyhbfsxbdwyiwkbt` ONLY.
**Forbidden target:** public waitlist `vnoxdinldneeczxibicp`.
**Decision:** HOLD — no hosted writes until backup/restore and migration approval are documented.

## Verified pre-deployment evidence
- CLI authenticated and UAT-linked in isolated worktree (operator log).
- `supabase migration list --linked` reports eight local migrations and no remote versions.
- `supabase db push --dry-run` reports eight pending migrations, without applying them.
- Connected UAT read-only SQL confirms PostgreSQL 17.11; `operations_private`, `iway_private`, and `supabase_migrations.schema_migrations` absent.
- Connected UAT migration list is empty.
- Local source checks 12/12 PASS, disposable PostgreSQL 17 migrations 8/8 PASS, tenant isolation suite PASS.

## Mandatory approval record (complete before write)
- [ ] Project owner confirms target `zolwjyhbfsxbdwyiwkbt`.
- [ ] Backup/PITR availability and an independently tested restore path confirmed by database owner.
- [ ] Recovery owner and maximum acceptable downtime recorded.
- [ ] Review eight migration files and required custom role provisioning; no secrets committed.
- [ ] Revoke the CLI login token whose authorization link/code was pasted in chat; reauthenticate privately.
- [ ] Obtain explicit authorization to run the UAT-only migration push.
- [ ] Reconfirm isolated worktree linkage and rerun dry-run immediately before write.

## Controlled execution (operator, only after all gates)
From the isolated UAT worktree, verify `supabase/.temp/project-ref` equals `zolwjyhbfsxbdwyiwkbt`.
Run `npx supabase migration list --linked`, then `npx supabase db push --dry-run`.
Only after owner approval: `npx supabase db push --linked`. Never add `--include-all` without reviewing history.
If any step fails, STOP. Do not blindly retry or mark migrations as applied.

## Post-deployment verification
- Confirm exactly eight expected versions in remote migration history.
- Inspect schemas, tables, FORCE RLS flags, policies, grants, and no unintended API exposure.
- Confirm login, registration, runtime and provisioner role privileges with non-owner sessions.
- Run security advisors and review every finding.
- Run four-persona hosted authentication and logistics E2E tests, including cross-tenant denial, dispatcher activation/deactivation, recovery and rollback exercises.
- Keep production NO-GO until hosted UAT is certified.

## Rollback
Use the owner-approved recovery procedure and verified restore point. Do not assume reverse SQL can safely undo data-bearing migrations. Preserve logs and first error.
