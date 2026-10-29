# Recovery Lab V2 and staging disaster recovery

Scope: local recovery engineering on October 29, 2026. This runbook does not authorize hosted writes or certify hosted disaster recovery.

## Accountability and gates

Responsible recovery operator, approving database owner, incident commander, maximum downtime, RPO and RTO objectives: **[TBC]**. No objective or service guarantee is inferred from an empty UAT database or a fast local restore.

Approved application UAT project: `zolwjyhbfsxbdwyiwkbt`. Public waitlist `vnoxdinldneeczxibicp` is forbidden. The original `C:\IWAY-Recovery-Lab` and unrelated Docker resources are outside the execution scope. Hosted restoration requires approval naming a separate recovery target, cost, exact backup hashes, operator, cutover, validation and rollback. Never restore into the live source to test a backup.

## Local sequence actually exercised

1. Verify all five files against `C:\IWAY-Secure-Backups\IWAY-UAT-20261028-194355\recovery-hashes.csv`. Keep original roles/schema/data and compatibility copies immutable. The V2 workflow uses the original data dump, including every managed Auth/Storage COPY section.
2. Obtain CLI 2.122.0 from the official release; verify the archive against its published checksums. Generate a separate config at `C:\IWAY-Recovery-Lab-V2`. Refuse existing directories, conflicting ports and project/container names.
3. Start pinned PostgreSQL `17.11.0.006`, GoTrue `v2.197.0`, Storage `v1.84.19` and supporting gateway/mail/REST services. Studio, analytics, Realtime and Edge Runtime are excluded to limit resource use. Record actual image IDs and health.
4. Run `node scripts/recovery-v2-loopback.mjs`. The CLI overrides the network's default binding, so verify actual published bindings are **127.0.0.1**, not just the network option. Recreated V2 containers retain the same named volumes. Stopped V2 predecessors remain for rollback. Transfer generated gateway configuration/local TLS material only in memory between these V2 containers; never export it to Git or evidence.
5. Set `IWAY_RECOVERY_BACKUP` privately to the backup directory. Run `node scripts/recovery-lab-v2.mjs catalog`, then `node scripts/recovery-lab-v2.mjs restore`. The runner refuses absent tables/columns and nonempty target COPY tables. It never drops managed schemas or removes incompatible data sections.
6. Execute original roles/schema/data in one transaction with `ON_ERROR_STOP`. The **local recovery management** identity is `supabase_admin`; this is not an application-runtime certificate. Bootstrap only the inert NOLOGIN Realtime role required by the original parameter grant. No original role grant was omitted in the successful run. Do not disable triggers.
7. Independently reconcile all 31 COPY counts and foreign-key validation. The source backup contains zero rows in these COPY sections; this does not prove recovery of populated accounts, payments, files or tenant data.
8. Run `node scripts/certify-recovery-v2.mjs` against a freshly restored V2 target. It injects a transactional failure, verifies rollback, installs the exact eight migrations as local `postgres`, and authenticates as the actual restricted local runtime over the published port. Passwords remain in memory. Wrong-password, same-tenant, cross-tenant and unauthorized-write assertions use the restricted login, never administrator impersonation.
9. A resume is allowed only with `--resume` and a matching recorded eight-migration checksum/completion prefix. Do not retry migrations blindly. In this execution, the initial legacy SQL harness lacked a SET-role capability; it was replaced by actual restricted-login assertions. Earlier failed attempts remain recorded.
10. Run `node scripts/certify-local-gotrue-v2.mjs` for actual **local** password, refresh, TOTP/AAL2 and logout protocol checks. Four synthetic local identities receive no application grants. This does not test real Google accounts, hosted identities or hosted application sessions.

Local TOTP flags are enabled only in V2. The scripts never change hosted Auth settings, factors, accounts or delivery providers. The local mail sink is not an invitation delivery service certification.

## Managed parity and limitations

Every original COPY table/column is available, including both MFA recovery tables, SCIM users and one-time-token expiry. PostgreSQL reports 17.11. Comparison also checks types, constraints, function signatures/body hashes, roles, policies and extensions.

Full managed parity is **BLOCKED**: V2 Storage has newer Iceberg objects/function and lacks hosted `storage.buckets.buckets_versioning_dark_check`. Managed schemas excluded by the logical schema dump depend on service migrations; database object restoration is not full service restoration. Storage object bytes, encryption-root handling, signing/SMTP/provider configuration, migration-history recovery and populated account recovery remain separate checks.

Do not hand-edit Supabase-owned schemas merely to make the diff disappear. Obtain a provider-supported compatible managed recovery target, repeat a populated-data rehearsal with approved synthetic data, and independently verify service behavior before a hosted recovery GO.

## Failure, rollback and stop conditions

- Hash mismatch, wrong target, unexpected role grants, schema gaps, nonempty restore tables, unvalidated foreign keys or loss of loopback isolation: stop before restore.
- SQL errors abort the transaction; retain SQLSTATE only. Do not persist psql CONTEXT/DETAIL, which can contain private rows. Verify absence of partial objects before retrying.
- Container rebind failure restores retained V2 container names and starts the predecessor. Never remove named volumes, original-lab containers or unrelated Docker resources.
- Application migration interruption: preserve committed-prefix evidence; compare exact hashes/history, inspect the failed transaction, obtain the specific recovery approval, then apply only the reviewed remaining suffix. Prior 3+5 interruption evidence is retained; it is not a new hosted execution.
- Hosted incident: fence writes through an approved process, restore into the approved separate target, validate database/service/data/security contracts, then obtain cutover approval. Preserve the source and a rollback endpoint. Do not assume reverse DDL is a safe rollback for data-bearing changes.

## Official references

Pinned service catalog: [CLI 2.122.0 Dockerfile](https://github.com/supabase/cli/blob/v2.122.0/apps/cli-go/pkg/config/templates/Dockerfile). Restore guidance: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [local downloaded backups](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup). These guides inform the procedure; the receipts establish what actually ran.
