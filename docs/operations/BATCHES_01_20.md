# Local operations implementation — batches 01–20

Date: 2026-10-11. Branch: work/wave0-reconciliation-20261011.

Historical checkpoint: bec1ea9. For the current B01–40 matrix, 134-test gate and 8 real Chromium tests, see [BATCHES_21_40.md](BATCHES_21_40.md) and [BROWSER_EVIDENCE.md](BROWSER_EVIDENCE.md). The browser limitation below describes that historical checkpoint and is now closed for the tested local scope.

**Certification: PARTIAL.** The durable local API journey is verified. Hosted certification remains BLOCKED. A live AI provider and browser verification are also BLOCKED. These limitations prevent whole-batch certification; the table does not promote local test results into hosted PASS claims.

## Baseline and boundaries
Baseline 1689353 contained public registration, a pure authorization helper and static pages. The logistics dashboards, durable load lifecycle and workflow engine described in the brief did not exist. Earlier wave-0 checklist statements are not evidence for these capabilities.

TLS remediation is preserved in commit 35976be. Restricted Supabase authentication remains blocked (28P01). This implementation does not load .env.local, connect to Supabase, alter consent, run migrations or enable hosted certification. Public site content and its deployment boundary are unchanged.

## Architecture decision
Reuse the established Node ESM stack with native Node 24.13+ SQLite for an explicitly local, loopback-only workspace. This provides durable local behavior, not a hosted database replacement. No runtime dependency was added. Internal operational pages live in apps/operations, outside site/public.

SQLite BEGIN IMMEDIATE transactions cover resource mutations, idempotency receipts and audit entries. Database indexes prevent multiple active assignments for a load, driver or vehicle. Resource versions reject stale writes. Tenant IDs are derived from persisted principals; all operation queries include tenant scope. Append-only audit triggers reject modification or deletion.

Passwords use salted scrypt. Sessions are hashed at rest, expire after eight hours and check account activation on every request. Cookies are HttpOnly/SameSite; mutations require matching Origin and CSRF tokens. The app binds only 127.0.0.1 with exact Host validation, CSP and no-store responses. The internal workflow service cannot log in, approve recommendations, dispatch loads or change finances.

Carrier managers own commercial terms and final eligibility. Dispatchers operate assigned loads. Drivers execute their assignments and cannot see commercial fields. Fleet administrators manage their own employment and equipment; carrier approval is independent. Ownership cannot be silently reassigned. Master records deactivate or void rather than being deleted.

## Batch evidence matrix
PARTIAL means implemented local behavior has evidence, but complete acceptance still requires the listed gate. No batch below is represented as hosted-certified.

| Batch | Status | Implemented evidence | Remaining gate |
|---|---|---|---|
| 01 | PASS | Actual repository and prior evidence reconciled; this decision record | None for baseline audit |
| 02 | PARTIAL | Role + explicit permission + tenant + relationship checks; core/auth/HTTP tests | Hosted identity/persistence verification |
| 03 | PARTIAL | Protected branded shell; responsive CSS; client render and route tests | Real browser, keyboard and 390/1440 visual checks |
| 04 | PARTIAL | Carrier totals, creation, personnel, approvals and finance; real API/client tests | Browser and hosted verification |
| 05 | PARTIAL | Assigned dispatcher loads, validation, assignment and review; denial/concurrency tests | Browser and hosted verification |
| 06 | PARTIAL | Driver assignments, acceptance and stop execution; commercial isolation | Browser and hosted verification |
| 07 | PARTIAL | Fleet equipment, employee creation/deactivation and relationship isolation | Browser and hosted verification |
| 08 | PARTIAL | Persisted lifecycle, ordered stops, optimistic versions and replay receipts | Hosted persistence/recovery certification |
| 09 | PARTIAL | Carrier eligibility approvals, unique assignments/reassignment and audit | Hosted certification |
| 10 | PARTIAL | Wave 1 gate: 49/49 tests, IP scan and site checks passed before commit 19952ca | Browser E2E and hosted certification |
| 11 | PARTIAL | Shipment created atomically with load; lifecycle and ownership synchronized | Hosted integration |
| 12 | PARTIAL | Active/available/approved drivers, expiry, critical compliance and busy checks | Hosted integration |
| 13 | PARTIAL | Explicit vehicle owner, maintenance/capacity/availability and eligibility | Hosted integration |
| 14 | PARTIAL | Accept → pickup → transit → delivery; sequential stops and proof reference | Browser and hosted integration |
| 15 | PARTIAL | Persisted tracking, exceptions, escalation and stop/transit holds | External tracking provider if required |
| 16 | PARTIAL | Durable checkpoints, bounded retries/backoff, idempotency, two-process concurrency and crash recovery | Distributed hosted execution |
| 17 | PARTIAL | Separate human reviewer, expiry, version binding, rejection/restart and replay protection | Hosted identity/certification |
| 18 | PARTIAL | Explainable rules-based advisory recommendation with approval boundary | Approved model provider and AI evaluation; model inference BLOCKED |
| 19 | PARTIAL | Integer-cent base + charges, factor/customer billing, carrier-timezone pickup pay week, immutable approved invoice snapshot and audit | Hosted integration; settlements/payments are not implemented |
| 20 | PARTIAL | Full real HTTP journey and 73-test regression gate | Browser, model-generated recommendation and hosted E2E certification |

## Verification actually executed
- Wave 1: npm run verify — 49 passed, 0 failed, 0 skipped; IP scan PASS; site structure PASS (4 pages).
- Final Wave 2: npm run verify — **73 passed, 0 failed, 0 skipped**; IP scan PASS; site structure PASS (4 pages).
- 34 operations tests add real SQLite and HTTP integration to the pre-existing 39 tests.
- Integrated HTTP journey: carrier creates load → dispatcher validates → eligible assignment → driver accepts → pickup → transit → tracking + exception → rules recommendation → carrier approval → resolution → delivery → invoice preparation/approval → audit.
- Negative paths: unauthorized/cross-tenant requests, forged client scope, expired sessions, CSRF/Origin failures, invalid/stale transitions, unsafe or busy equipment, duplicate events, self/rejected/expired approvals and changed eligibility.
- Two independent processes contend for assignment and approval; one succeeds. Two worker processes produce one recommendation/approval pair.
- A child process exits during the actual recommendation/approval transaction, before COMMIT. No partial checkpoint survives; a new database connection resumes the pending workflow.
- Client JavaScript runs against the real HTTP API in a minimal DOM harness: persona rendering, escaping saved text and reusing an idempotency key after a lost response. **This is not a browser test.**
- Browser attempt: the in-app browser reported unavailable; the browser inventory returned zero browsers. No browser clicks, viewport screenshots, keyboard audit or console certification were completed.

## Local operator entry
Requirements: Node 24.13+ and npm install from the existing lockfile.

Initialize an empty workspace using:
`npm run ops:init -- <username> <display-name> <tenant-name> [IANA-timezone]`

Supply a 12–256 character password through standard input from a secure local input mechanism; do not put it in command arguments, source files, logs or a visible shell history. The default timezone is America/Chicago. Initialization refuses an existing workspace.

Run `npm run ops:start` and visit http://127.0.0.1:4180. SQLite data defaults to ignored data/operations.sqlite. IWAY_OPS_DB and IWAY_OPS_PORT select a local file/port without loading .env.local. The workflow worker resumes unfinished checkpoints on startup.

For future browser QA, `node tests/helpers/browser-fixture.mjs` starts isolated illustrative data at http://127.0.0.1:4181. Test-only account definitions are in tests/helpers/operations-fixture.mjs. Never reuse these accounts in a real workspace.

## Operational limitations
This is a single-host local implementation. Production identity, HTTPS termination, hosted database isolation, retention/backups, monitoring and distributed worker behavior require approved work and verification. Audit protection covers application/database operations, not an administrator who can replace the local database file.

Recommendations explicitly report source=rules and model=null. No model provider is configured or invoked. The system does not claim these recommendations are AI-generated. Human approval can resolve an exception only while the bound load version remains current and required eligibility still holds; it never autonomously changes dispatch assignment or commercial terms. Approving a hold keeps the exception open.

Money values are user-entered USD cents. Invoice readiness is not payment, settlement, deduction, escrow or tax computation. No external payment action exists. Tracking is manually recorded; delivery proof is a reference, not an uploaded document.

## Parking lot — unchanged and not executed
- Restricted Supabase authentication: 28P01 — supply/verify the dedicated role credential securely in a separately authorized session.
- Approved IWAY_CONSENT_VERSION — obtain approved consent text/version; do not invent a placeholder.
- Hosted registration certification — execute only after identity, consent and explicit authorization gates pass.
- Previously exposed owner password and service-role key — authorized owner must rotate securely; not performed here.
- Production deployment and hosted integration approval — obtain explicit authorization after remaining checks.

## Proposed batches 21–30
21. Restore an available browser; run the full persona journey, keyboard audit and 390/1440 visual checks.
22. Approved production identity/session integration and account recovery.
23. Separately authorized restricted Supabase credential remediation and secure exposed-secret rotation.
24. Approved hosted operational schema/isolation integration and persistence contract tests.
25. Hosted worker leases, retries, monitoring and restart/restore verification.
26. Approved AI provider adapter, data minimization, prompt-injection defenses and recommendation evaluations.
27. Browser + hosted end-to-end journey with human approval and adversarial regression tests.
28. Approved settlement/deduction/escrow business rules and audited financial controls.
29. Approved tracking/POD integration, notifications and operational observability.
30. Consent approval, hosted registration certification and production release review.

## Subsequent convergence
The historical table above describes bec1ea9. Wave 3 re-ran its 73-test baseline, closed command-response and explicit-permission gaps, and established real Chromium browser tests. See BATCHES_21_40.md and BROWSER_EVIDENCE.md for current evidence. Hosted and model-provider gates remain unresolved.
