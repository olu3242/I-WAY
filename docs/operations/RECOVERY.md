# Local operations backup and recovery

Scope: the supported local SQLite operations store. Hosted PostgreSQL backups, off-site replication, encrypted vaults, retention schedules, and disaster-recovery infrastructure remain uncertified. These tools do not load environment files or contact Supabase.

## Commands

Run from the project with Node 24.13 or newer:

~~~powershell
node scripts/operations-backup.mjs C:\Private-Iway\operations.sqlite C:\Private-Iway-Backups\snapshot-001
node scripts/operations-restore.mjs C:\Private-Iway-Backups\snapshot-001 C:\Private-Iway-Recovery\restore-001 TRUSTED_MANIFEST_SHA256
node scripts/operations-recovery-rehearsal.mjs
~~~

Each destination must be a **new directory** under an existing parent. Backup and restore never overwrite an existing file or directory. Use explicit paths to the intended operations store; there is no production-database discovery. Preserve the returned manifest SHA-256 separately through a trusted administrative channel.

The Node online-backup API copies committed SQLite state, including WAL-backed transactions, while the application runs. It can restart its copy when another connection commits. Do not substitute a raw copy of an active main database file. The source is opened read-only; integrity, foreign keys, required operations schema, and audit controls are verified. [Node 24.16 SQLite documentation](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)

New output directories use mode 0700 on Unix. On Windows, inherited ACLs are removed and full control is granted only to the current user SID, SYSTEM, and Administrators. Files remain inside that restricted directory. Symlinked paths and public site/Git metadata destinations are rejected. Permission-setup failures stop before copying. Source permissions are unchanged.

Backups contain confidential records and password hashes. They are **not application-encrypted**. Use an access-controlled encrypted disk or approved vault outside the repository and public hosting roots. Hashes detect changes only against the separately trusted digest; an adjacent editable manifest alone does not establish authenticity.

## Recovery procedure

1. Preserve the failed store and its WAL/SHM files. Stop the original application before switching to the restored copy. Never run both as the same operational environment.
2. Select the backup and independently retained digest. Restore into a new private directory.
3. Require PASS. Restore verifies the manifest digest, database hash/size, SQLite integrity, relationships, schema, and recovery-point metadata.
4. Restored sessions are revoked. A restoration audit event is appended per tenant; the old audit prefix remains unchanged.
5. Start local operations using the restored path through the existing process-local IWAY_OPS_DB option. Do not edit credentials or consent configuration. Operators sign in again.
6. Inspect restored data and the workflow queue. Persisted lease/fencing controls apply; eligible local checkpoints resume. No external provider is activated.
7. Complete persona/API checks before a human-authorized cutover. Retain original data and evidence until disposal is approved under the retention policy.

Failed attempts leave the new target incomplete. There is no overwrite, automatic deletion, or in-place rollback. Never start an incomplete restore; quarantine it and choose a different new target.

## Measured rehearsal

The rehearsal command creates a disposable fixture, backs up an authenticated workspace and pending five-step advisory job, commits one additional fixture shipment, simulates failure, restores, checks audit history/session revocation, and completes the recovered job.

It writes dist/operations-evidence/recovery.json:

- observedRpoMs: failure time minus the last recoverable audit timestamp.
- observedRtoMs: failure to verified restore, preserved audit history, revoked sessions, and completed recovered workflow.
- restoreDurationMs: tooling time within that broader recovery measurement.
- hostedCertified: false.

The deliberately committed post-snapshot fixture shipment and two audit events are absent. The 10-second local RTO regression budget applies only to this small fixture, not production. Real RPO depends on backup cadence and storage durability.

Initial independent rehearsal on 2026-10-11: 135,168-byte backup; observed RPO 458 ms; observed RTO 224.33 ms; restore 199.64 ms. All six integrity/functional checks passed. Latest machine evidence supersedes these historical values.
