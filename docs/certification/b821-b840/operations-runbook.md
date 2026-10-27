# UAT incident and rollback readiness

This is a preparation package, not evidence of a hosted recovery rehearsal. Production, the public early-access project and unrelated databases are excluded.

Target: isolated `iway-auth-staging`, project `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, genuine Preview only. Database, authenticated management owner, approved invitation provider and known-good hosted recovery deployment remain unidentified. Those fields must be owner-recorded before activation.

1. Record the incident time, approved deployment ID/commit, affected workflow and sanitized correlation IDs. Do not copy cookies, session/JWT material, database URLs, private operational records or provider responses into feedback or logs.
2. Release owner pauses the UAT exercise and contacts the named database, identity and delivery owners. Any proposed hosted write-disable/configuration change needs its explicit owner authorization. Keep SSO, MFA, RLS, CSRF, tenant gates and human financial approvals enabled.
3. Read authorized health and version evidence. For an unknown transaction outcome, read the authoritative current record, then retry the identical command with its original idempotency key. Do not generate a replacement financial command or mark notification/payment delivery successful from a timeout.
4. On PostgreSQL connection loss, fail closed. Restore the designated staging database under its owner's recovery procedure, verify restricted `session_user=current_user`, role flags/grants and RLS, then re-read versions and receipts. Disposable local restart and SQLite restore evidence do not certify hosted backup coverage, RTO or RPO.
5. Revoked/expired authentication requires approved sign-in/refresh and current membership checks. Do not copy old browser storage, bypass deployment protection, impersonate the runtime with administrator credentials or mint MFA proofs.
6. Roll back application code only to an independently reviewed, protected Preview recovery candidate with verified database/record compatibility. Do not promote a merely READY deployment or a different project's build. Record old/new IDs, SHA/archive checksum and verification outcomes.
7. **Feedback compatibility gate:** once governance feedback records exist, plain rollback to `c5998b3` will reject its governance namespace because that bridge knows only four resource kinds. A rollback candidate must retain the exact `uatfeedback`/`uatfeedbackevent` governance-kind allowlist while disabling new feedback entry if necessary. Preserve all records and append-only history; never hard-delete feedback to make old code start. The runtime schema otherwise remains unchanged. Review and test this compatibility candidate before approving any hosted rollback.
8. Validate the same four-persona negative matrix, confirmed persistence, financial source totals, current sessions and audit continuity after recovery. Resume only with an accountable owner decision and recorded tester retests.

| Required operational owner input | Current evidence |
|---|---|
| Exclusive staging database and authenticated management connection | BLOCKED; public early-access database explicitly excluded |
| Backup owner, schedule, encrypted location and retention | BLOCKED; no approved staging target |
| Restore permissions and clean restricted runtime handoff | BLOCKED; disposable tests only |
| Hosted recovery deployment and compatibility approval | BLOCKED; current candidate not deployed |
| Hosted recovery objective and observed outage/data-loss interval | NOT RUN; no SLA inferred from local measurements |
| Notification delivery owner and provider confirmation contract | BLOCKED; local records never mean external delivery |
| Human acceptance and incident communications owner | Not recorded; no messages sent |

Local evidence covers transactional failure, stable-key retries, stale versions, bounded offline replay, local notification failure/retry, session revocation, actual disposable PostgreSQL restart, tenant denial and SQLite backup/restore. Financial approval still denotes an obligation or reviewed statement, not transferred money.
