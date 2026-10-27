# Implemented local contracts

Authority: PRD BR-001–BR-020, the checked-in Make prototype for flows, and the Brand Kit for styling. This records implementation scope, not approval for hosted activation.

## Driver device queue

IndexedDB holds at most 20 version-1 envelopes, 2048 serialized characters each, for 24 hours. Allowed actions: accept assignment, pickup with stop identifier, transit. Envelopes bind actor, tenant, authority fingerprint, resource version and stable UUID idempotency key. No password, cookie, session/CSRF/access token, name, customer/location data, image, signature or proof is persisted.

Replay obtains a fresh authenticated session/CSRF in memory. The server rechecks live assignment and eligibility before even returning an idempotent receipt. Retry is explicit and sequential; conflicts stop replay. The UI distinguishes queued, sending, confirmed and needs-attention states. Cancellation removes only the device copy; it cannot undo an already committed server effect. Logout purges the queue. Browser locks and an atomic IndexedDB capacity check coordinate tabs.

The service worker caches only generic recovery HTML, CSS, queue code, validation policy and local font. It caches no APIs, Auth, personalized HTML or documents. Only network failure can return the recovery page; HTTP authentication denials pass through. Photos/signatures/POD, native/background location and secure offline document storage remain incomplete pending ADR-002/OQ-08.

## Settlements and fleet driver pay

Amounts are integer USD cents. Explicit basis points, half-up-cent rounding and a reason/terms reference are required. No real financial terms are invented or provisioned. The pay week uses first confirmed pickup in carrier time zone, matching the existing invoice contract.

Each delivered load is counted once with validated BOL and acknowledged delivery evidence. Unique indexes enforce one settlement per tenant/payee/week and one driver-pay row per tenant/driver/week. Distinct bounded deductions apply once weekly. Net equals revenue share minus administration fee, deductions and capped escrow plus adjustment. Negative/unsafe results fail. Escrow derives from approved contributions, never direct editing. The PRD fixture produces 1,215,000 cents net.

Approval rechecks source versions and escrow calculations. Approved records freeze at persistence; reopening requires an audited reason. Approved dependent driver pay prevents reopening its source fleet settlement. Disputes append evidence without altering the statement.

The carrier owns carrier-driver and fleet-company settlements; each fleet owns its driver pay. The implemented fleet model is per completed load, bounded by approved fleet net. Approval rechecks live employment and remaining budget. Driver projections exclude commercial source fields and carrier-to-fleet statements. Approval indicates payable amounts, not transferred funds.

Other pay models, vehicle-sourced terms, week moves/cutoffs, PDFs, actual payments and complete escrow debits/refunds remain incomplete.

## Assignment, search and maintenance

Only the currently assigned driver may reject a pending assignment with a reason. It releases the active assignment, returns the load to validated and creates an audited replay-safe receipt. It cannot void/re-rate the load or reject an accepted/in-progress assignment.

Search filters only visible relationship-scoped records, including active and delivered/voided lists. Carrier service intervals and warning distances are explicit. Driver service reports require assigned equipment. Odometer readings cannot decrease. The equipment owner reviews reports; approved scheduled service can advance its due mileage. Reports never clear carrier compliance/out-of-service authority. Carrier projections of fleet history omit private notes. Automatic location/distance collection remains absent.

## Brand and measurement

The supplied logo is unchanged. Inter 4.1 is served locally with its original [upstream license](https://github.com/rsms/inter/blob/v4.1/LICENSE.txt) retained at apps/operations/Inter-LICENSE.txt. [Release source](https://github.com/rsms/inter/tree/v4.1); WOFF2 SHA-256: 693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3.

Tests measure font loading, selected token colors/radii, logo treatment, driver targets and responsive/keyboard outcomes. They do not establish complete typography/icon/spacing conformity, WCAG conformance or original-screen similarity. See requirements.json and gap-register.md for every PRD row. Partial/missing implementation is not relabeled as an approval blocker. Original-screen comparisons are BLOCKED_REFERENCE.

Existing principals receive no automatic grants. New permission catalog entries require explicit role/roster reconciliation before hosted provisioning. A01–A12 remain pending; no hosted action occurs.
