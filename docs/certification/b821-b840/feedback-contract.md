# Governed UAT feedback

Implemented API: `POST /api/ops/feedback`. The Operations application owns this workflow. It uses the existing trusted application session, same-origin and CSRF checks, tenant store, command receipts, optimistic versions and transactional audit. The existing PostgreSQL engine persists records and events in the tenant payload. No new hosted migration was executed.

Access is disabled by default. A separately approved management procedure must record `uatFeedbackAccess` on an existing native principal as an array containing `submit` and/or `triage`. The application provides no self-enrollment, delegation or grant endpoint for this opt-in. It does not extend the canonical login permission catalog or change any existing account. Current stored access is checked on every call, including idempotent replay.

| Capability | Additional required existing authority | Scope |
|---|---|---|
| Submit and track own feedback | Platform: `platform:audit`; Carrier/Fleet/Driver: `load:view` | Same tenant/governance realm, own reporter ID |
| Platform triage | `platform:cases` | Own governance realm only |
| Carrier triage | `user:manage` | Own carrier tenant |
| Fleet triage | `employment:manage` | Own non-null fleet in own carrier tenant |

Privileged Platform and Carrier feedback access requires verified AAL2. Existing session, membership, principal-fingerprint, owner-profile and deny-only policy checks remain authoritative. An unknown role, missing base authority, revoked opt-in or untrusted session cannot acquire feedback access. The new opt-in does not grant operational or cross-tenant authority.

Reports store server-derived immutable reporter/persona/tenant/fleet IDs, UTC timestamps, version, workflow, symptom, impact, reproducibility, owner and status. Only enumerated metadata is accepted. No free-text diagnostic fields, URLs, files, screenshots, user-entered identities, financial data or authentication artifacts are accepted. Evidence references are a reviewed 40-character commit SHA or an opaque `run-` reference; these are references for an approved reviewer, not automatically fetched or verified provider evidence.

Lifecycle: `reported → triaged → in_progress → awaiting_retest`. An active authorized owner is mandatory at triage. A reviewed evidence reference is mandatory before retest. Only the original reporter can record failed retest (returns to `in_progress`) or passing retest (moves to immutable `closed`). Every successful change appends an event and audit record in the same transaction as the command receipt. Stale revisions and changed-payload replay fail. Creating more than ten reports within ten minutes per reporter is rejected; retries with the same key do not consume an additional report.

The UI is shared by the Operations and isolated Platform pages, uses existing brand components, labels every control, announces pending/success/error outcomes, prevents concurrent submissions, retains structured input after failures and uses stable request keys. Reports and confirmed history are reloaded from the authenticated API. No external issue tracker or delivery confirmation is implied.

Hosted activation requires the designated exclusive staging database, verified existing users and hierarchy, explicit per-person opt-ins and existing base grants, independent review of governance isolation, protected Preview entry and real-user retest evidence. Platform staff cannot read carrier reports through this endpoint; a future cross-tenant support reader still needs its separate approved scope, reason, expiry and independent approval.
