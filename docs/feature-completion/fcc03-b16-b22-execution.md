# FCC-03 — Batches 16–22 execution dossier

## Implemented in this wave
- B16: session-bound serialized ordered replay; preserves command keys and acknowledges only confirmed receipts.
- B17: network failure and ambiguous responses return needs_attention without deleting unresolved commands.
- B18: conflict or authorization rejection is not a confirmed receipt; changed identity stops replay.
- B19: Driver UI integration **NOT COMPLETE**. Existing operations UI does not load the offline module.
- B20: Driver/carrier/fleet browser E2E **NOT COMPLETE**. Cross-persona replay must be exercised through authenticated HTTP and durable state.
- B21: local regression dossier **PARTIAL** pending execution logs.
- B22: release certification **NO-GO** pending browser, accessibility, server-binding and hosted evidence.

## Acceptance gates
1. Run `node --test tests/driver-offline-session.test.mjs tests/driver-offline-replay-wave.test.mjs tests/driver-offline-storage.test.mjs`.
2. Run `npx playwright test tests/browser/driver-indexeddb.spec.mjs tests/browser/driver-indexeddb-failures.spec.mjs`.
3. Run `npm run verify`.
4. Verify authenticated server actor/tenant/session and current load assignment on every replay; browser-provided identity is not trusted.
5. Implement and test opt-in driver UI queue, logout/account switch lock, offline indicator, and accessible manual review.
6. Run driver/carrier/fleet E2E and preserve receipts, negative authorization evidence, performance, accessibility and recovery.
7. No hosted GO until independently approved consent, restricted identity, security, rollback and hosted test receipts exist.

Local unit success does not certify B19–B22 or hosted production.
