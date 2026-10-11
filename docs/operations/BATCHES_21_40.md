# Batches 21–40 — implementation and certification evidence

## Reconciled baseline
Expected branch work/wave0-reconciliation-20261011 was clean at bec1ea9. Commits 19952ca and bec1ea9 contain the actual local implementation. Before edits, npm run verify independently passed 73 tests (0 failed, 0 skipped), IP scan and all four public-page checks. Prior B01 PASS / B02–20 PARTIAL claims were accurate; hosted release remains NO-GO.

Foundational convergence fixed two issues found by independent review: mutation and idempotent replay responses now redact commercial fields for drivers/fleets and check current ownership; user/fleet/invoice listings respect explicit permissions rather than carrier role alone. The customer role uses a persisted customerId relationship, never company-name matching or client tenant claims. Documents, financial records and notifications retain separate permission checks.

Real Chromium testing is now reproducible with npm run test:browser. It uses isolated SQLite fixtures and loopback HTTP, not .env.local or Supabase. See BROWSER_EVIDENCE.md for exact browser runs. This closes the previous unavailable-browser gap locally; it does not establish hosted identity/persistence or model-provider readiness.

## Group A implementation
- B21: bounded 32 KiB plain-text/JSON ingestion, actual deterministic classification/extraction, confidence and provenance. Human review is mandatory; PDF/image OCR and model extraction are not configured.
- B22: shipment-linked BOL fields, content hashes, immutable version lineage and scoped content retrieval. Customers can retrieve only the latest validated BOL for their own shipments.
- B23: driver/assigned-dispatcher recipient acknowledgment, evidence reference and immutable completion event. No raw signature or GPS fields are accepted. Database triggers prohibit evidence modification/deletion.
- B24: missing, mismatched, pending or rejected document exceptions; escalation and audited resolution following corrected, reviewed evidence.
- B25: document-backed invoice generation/issue, exact integer cents, existing human finance approval and duplicate prevention. Legacy preparatory invoice records are retained; issuance always rechecks latest document/POD readiness.
- B26: reported payment evidence, matching/discrepancy correction, separate human reconciliation, balance protection and audited voiding. Evidence is labeled user_reported/local_fixture; there is no bank verification or money movement.
- B27: protected customer portal, shipment milestones, validated document access and issued invoice status. Own customer relationship and tenant are enforced at API/domain/persistence boundaries.
- B28: event-triggered local notification outbox, static templates, current-recipient authorization, preferences, suppression, idempotent records, bounded retry/backoff and dead letters. No external messages are sent.
- B29: recorded on-time delivery, cycle duration, exception rate, current utilization and invoice readiness with evidence IDs and denominators; absent measurements return null.
- B30: integrated local document/delivery/billing/customer tests plus browser journey. Hosted dependencies remain BLOCKED.

Group A full quality gate: **98 passed, 0 failed, 0 skipped**, IP scan PASS, site check PASS (4 pages). Final response authorization hardening also passed its 25 relevant domain tests. Browser results are maintained separately in BROWSER_EVIDENCE.md.

## Runtime and boundaries
New features compose through Operations.extensions and state-view functions. Existing load, finance, eligibility and transaction engines are reused. Operational assets remain in apps/operations, outside public site/. All fixtures are explicitly illustrative and disposable; no configured secrets or production data are used.

No hosted migration, RLS/permission change, credential reset, deployment, external financial action, live message or model-provider call is part of this work.

## Parking lot
Restricted Supabase authentication 28P01; approved IWAY_CONSENT_VERSION; rotation of exposed owner password and service-role key; hosted registration certification; production deployment approval; approved AI-provider integration. None is bypassed.

## Group B
Implementation and executable evidence will be recorded after Group A checkpoint.
