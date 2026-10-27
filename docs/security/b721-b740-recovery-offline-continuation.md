# Hosted recovery and offline routing continuation — 2026-10-25

Starting SHA: `46d3f4f3ed20f5887e98d5b29838431ae1995bc8`.

## Runtime changes

The shared hosted handler now bounds initialization waiting to 20 seconds, below the isolated function's configured 30-second limit. Concurrent callers share that deadline. A timed-out generation retires and returns sanitized HTTP 503; a later request can initialize a replacement. If the retired initialization eventually succeeds, its pools close once and it cannot replace the current runtime. This bounds request waiting, not arbitrary background work; underlying adapters retain their own I/O deadlines. Active application transactions are not timed out by this initialization guard.

The isolated deployment manifest previously omitted `/offline`, `/driver-sw.js`, and `/domain/driver-offline-replay.mjs`, despite application support for them. These exact routes now reach the authenticated application handler. Arbitrary domain/server files, documentation, environment files and prototype paths still return 404. Automatic Git deployment remains disabled; no deployment was performed.

## Recovery evidence implementation

The shared HTTP logistics scenario now issues concurrent identical create commands and asserts one load and one creation audit record. In disposable PostgreSQL mode it obtains a valid CSRF/session context, temporarily revokes the fixture runtime's state-update privilege, and sends the create command through HTTP. It requires sanitized 503 and exact unchanged persisted state/audit, restores fixture privileges in `finally`, retries the same command key, completes delivery, and checks replay/tenant isolation after a real database restart. This is fixture-only fault injection, not a hosted privilege change.

Both scenario modes request all three offline dependencies through authenticated driver HTTP. Manifest tests additionally verify route matching and private-path denial. Two handler tests cover stalled initialization/recovery/late cleanup and invalid deadline configuration.

## Certification boundaries

The starting commit's remote Verify, disposable PostgreSQL and durable-browser jobs passed. Its general browser job remained in progress during inspection. These are prior-commit results, not certification of this change. Current-commit CI results are recorded in draft PR #18 after publication.

Local browser and actual PostgreSQL execution remain unavailable in this container. The PostgreSQL fault/recovery scenario must pass remote CI for the new SHA. Live hosted activation and production remain NO-GO until actual runtime roles/schema/configuration, approved four-persona identity/tenant/MFA records, provider configuration, confidential onboarding delivery and protected Preview E2E are verified. No hosted schemas, credentials, identities, invitations or production settings changed.

Fresh local verification: `npm run verify` PASS, 903 tests passed, zero failed/skipped; syntax, public build, IP scan and site checks passed. Targeted tests passed and overlap this total. `git diff --check` passed. This does not claim live deployment validation.
