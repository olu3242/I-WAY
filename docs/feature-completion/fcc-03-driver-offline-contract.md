# FCC-03 driver offline readiness — source audit and implementation contract

Date: 2026-10-13
Parent: #3; execution story: #5
Branch audited: `work/b244-b253-certification-remediation-remote`

## Verified source observations
- `apps/operations/ops.js` sends driver commands through `/api/ops/commands`, with in-memory `pendingCommands` idempotency keys. The map is lost on page reload or process restart.
- The inspected `ops.js` and `extended.js` contain no IndexedDB, service worker, localStorage, `navigator.onLine`, or offline queue implementation.
- `tests/browser/operations.spec.mjs` exercises an online multi-persona journey but has no explicit offline/reconnect scenario.
- `server/operations-store.mjs` enforces tenant-scoped resource writes, expected versions, transaction rollback, append-only audit, and command idempotency on the server.
- The absence of an offline queue is **confirmed only for inspected files**. Inventory other assets and server routes before implementation.

## Required safe implementation contract
1. No optimistic delivery success: a command is *queued locally* until an authenticated server receipt is verified.
2. Do not persist session tokens, CSRF tokens, document images, PII or proof-of-delivery blobs in an unencrypted browser queue.
3. Persist a bounded command envelope with a stable UUID, resource ID, expected version, action and minimal allowed payload. Define explicit schema/version, expiry, maximum count, and size.
4. Bind queue to authenticated actor and tenant using a server-verifiable context; purge on logout, tenant switch, account revocation, and expiration. Never replay under a different principal.
5. Replay sequentially after connectivity returns, preserving original idempotency key. Server must re-check session, tenant, assignment, authorization and expected resource version.
6. Stop and surface conflict on stale version, revoked assignment, invalid evidence, authorization denial or expired session; never auto-resolve by overwriting server state.
7. Clearly distinguish `Queued on device`, `Sending`, `Confirmed by server`, and `Needs attention`. Expose keyboard-accessible status and retry/cancel controls.
8. Delivery/POD and document workflows require special treatment: do not queue sensitive payloads until secure storage and retention are independently reviewed.

## Mandatory tests
- Offline pickup -> reconnect -> one persisted pickup and one audit transition.
- Network drops after server commit but before response -> replay with same key -> no duplicate effect.
- Reload while offline -> queue survives and still belongs to original actor.
- Unassignment or reassignment before replay -> reject without state change.
- Tenant switch/logout -> old queue cannot replay.
- Expired session -> no replay until re-authentication and context verification.
- Stale expected version -> conflict shown, no automatic overwrite.
- No leakage of commercial/customer fields in driver view.
- Accessible status announcements and keyboard recovery.
- Repeat after server restart using persisted database assertions.

## Release boundary
Current local baseline reported by operator: 472/472 application tests and 12/12 browser tests PASS; these are not re-run by this document. PostgreSQL parity and hosted execution remain NO-GO. This contract is not implementation or certification evidence.

## Figma gap-closure implementation update — 2026-10-24

The observations above describe the historical audit. The current feature candidate implements the bounded browser status queue, authenticated replay endpoint and static recovery shell. See [implementation contracts](../certification/figma-gap-closure/implementation-contracts.md), [requirement review](../certification/figma-gap-closure/gap-register.md) and the final certification receipt for actual test evidence. Native photos/signatures and hosted authentication remain uncertified.
