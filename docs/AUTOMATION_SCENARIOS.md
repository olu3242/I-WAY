---
title: "I-way — Automation and Integration Scenarios"
subtitle: "Core automation, advanced automation and third-party end-to-end flows"
date: "October 10, 2026"
---

**Classification: INTERNAL — CONFIDENTIAL. Never reference on the public site.**

Companion to PRD §7–§12, §18 and BRD §8. Vendors are **candidates to be selected [TBC]**, not decisions. Release tags (R1–R4) match PRD §6.

# 1. Automation principles

| # | Principle | Why |
|---|---|---|
| P1 | **Humans approve money.** Automation may calculate, draft, flag and prepare; approval of settlements, payments and fleet fees stays with the owning role (BR-005, BR-006, BR-017). | v1 settlement defects |
| P2 | **Every automated action is audited** with actor = "system", trigger, inputs and result (BR-012). | Traceability |
| P3 | **Idempotent and replayable.** Each job has an idempotency key; duplicates never double-apply (e.g. a deduction counted twice). | v1 double-deduction bug |
| P4 | **Tenant context on every job.** A job runs as one carrier or fleet company and cannot read another (BR-010/011). | Isolation |
| P5 | **Outbox pattern.** State change and event are committed together; consumers retry with backoff and dead-letter on repeated failure. | Reliability |
| P6 | **Automation proposes, ownership rules decide.** A fleet-company event can request but never complete a carrier-owned step (§5.2). | One owner per function |
| P7 | **Kill switch and dry-run** per automation and per tenant; configurable thresholds and quiet hours. | Safe rollout |
| P8 | **Fail visible.** Failures create a work item or case, never silent drops. | v1 silent failures |
| P9 | **Sensitive data never enters logs, prompts, events or vendor payloads** beyond the minimum required (§12.3). | Privacy |

# 2. Core automation scenarios

Trigger → automated actions → owner. All are rule-based (no AI).

## 2.1 Identity and onboarding

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-001 | Carrier creates driver invite | Send invite (email/SMS) with expiring link; reminders at +2 and +5 days; mark expired; allow resend | Carrier | R1 |
| AUT-002 | Driver submits onboarding | Checklist validation (required fields, documents present, agreements signed); route to reviewer queue; set status Under Review | Carrier | R1 |
| AUT-003 | Reviewer approves/rejects/needs info | Update status; notify driver (and fleet company); set Dispatch Eligible only when every blocking item is valid | Carrier | R1 |
| AUT-004 | Same pattern for vehicle, truck owner, broker, customer, factoring company | Duplicate checks (VIN, plate, EIN, MC number); draft broker created from rate-con import; records stay invisible to dispatch until approved | Carrier | R1 |
| AUT-005 | Failed sign-ins, new device, role change | Lockout, MFA step-up, security notice, audit event | Platform | R1 |
| AUT-006 | Carrier tenant approved | Provision defaults (roles, statuses, document types, notification templates, pay-week calendar in carrier time zone) | Platform | R1 |

## 2.2 Compliance and equipment

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-010 | Nightly document scan | Compute Valid / Expiring Soon / Expired; send reminders at 60/30/14/7 days to driver, owner and compliance queue | Carrier | R1 |
| AUT-011 | Critical document expires or is rejected | Set Dispatch Eligible = No (BR-020); block assignment; notify dispatcher; unassigned-load alert if it affects a booked load | Carrier | R1 |
| AUT-012 | Driver uploads replacement ("Renew") | Move document to Under Review; notify compliance; on approval clear block and notify driver and fleet company | Carrier | R1 |
| AUT-013 | Odometer updates (load distance + geolocation while truck and driver in service) | Compare with service interval; warn driver and carrier at configured threshold; create maintenance task | Carrier / Fleet | R1 |
| AUT-014 | Service record added by admin or driver | Sync to truck history; reset interval; deduplicate | Carrier / Fleet | R1 |
| AUT-015 | Equipment out of service | Remove from assignable pool; flag affected loads | Carrier | R1 |

## 2.3 Load and dispatch

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-020 | Load created | Auto time zone from stop city/state; compute pay week from first pickup (BR-016); validate rate > 0; geocode facilities | Carrier | R1 |
| AUT-021 | Dispatcher assigns | Eligibility check (driver, truck, owner, documents, one active assignment); end prior assignment; notify driver (push/SMS); start acceptance timer | Carrier | R1 |
| AUT-022 | Acceptance timer lapses | Reminder to driver; escalate to dispatcher; suggest next eligible driver (dispatcher confirms) | Carrier | R1 |
| AUT-023 | Driver rejects with reason | Return load to Unassigned; notify dispatcher; record reason | Carrier | R1 |
| AUT-024 | Geofence entered/left | Prompt arrival/departure; manual fallback if signal fails; stamp StopEvent with location and time; update status | Driver | R1 |
| AUT-025 | No movement or no check-in beyond threshold | Alert dispatcher; request driver ping | Carrier | R1 |
| AUT-026 | ETA exceeds appointment window | Flag Delayed; notify dispatcher; draft broker delay notice for approval | Carrier | R1 |
| AUT-027 | Detention clock exceeds free time | Start detention evidence; prompt driver; notify dispatcher | Carrier | R1 |
| AUT-028 | Multi-stop load | Require each pickup/drop confirmed in order; roll status only when stop set complete | Driver | R1 |

## 2.4 Documents and communications

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-030 | Load picked up / delivered | Email broker (address from book of record) with timestamps | Carrier | R1 |
| AUT-031 | BOL signed (driver, shipper) | Generate signed PDF; attach to load; push to broker and load manager; carry same copy to receiver signature | Driver | R1 |
| AUT-032 | POD signed at delivery | Generate final PDF; attach; send BOL/POD to broker; move to POD Submitted; queue carrier review | Driver | R1 |
| AUT-033 | Dispatcher requests tracking link | Create token link with expiry; email broker contact; revoke on delivery or expiry; log views | Carrier | R1 |
| AUT-034 | Any upload | Sanitize file name; virus scan; image normalization; thumbnail | Platform | R1 |

## 2.5 Money

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-040 | Load Completed | Create draft invoice (carrier prefix + year + sequence); assemble packet (invoice, rate confirmation, BOLs, POD); route to factoring company if factored, else Bill To | Carrier | R2 |
| AUT-041 | Packet ready | Pre-send validation (all required documents, amount, Bill To email); human approves send | Carrier | R2 |
| AUT-042 | Invoice sent | Start payment-due clock; remind at due date; age into AR buckets | Carrier | R2 |
| AUT-043 | Payment recorded (manual or integrated) | Match to invoice; support partial payment; update status; notify accounting; feed days-to-pay report | Carrier | R2 |
| AUT-044 | New pay week begins (Monday, carrier zone) | Create week once only; assign loads by first pickup; apply carrier cut-off for late loads | Carrier | R2 |
| AUT-045 | Pay week closes | Build settlement drafts per payee from vehicle financial settings; each deduction once per payee per week; escrow instalment from approved settlements only (BR-018) | Carrier | R2 |
| AUT-046 | Draft settlement ready | Run validation (no zero or negative surprises, no double deductions, payee without escrow valid); present preview for approval | Carrier | R2 |
| AUT-047 | Settlement approved | Lock; generate statement PDF (carrier name/address, owner + last 6 of VIN); notify payee; no adjustments allowed; un-approve only with reason | Carrier | R2 |
| AUT-048 | Load moved to another week | Recalculate both weeks; show in target tab; audit | Carrier | R2 |
| AUT-049 | Dispatcher settlement | Percent-of-gross terms applied to dispatched loads; statement PDF | Carrier | R2 |
| AUT-050 | Fleet settlement (managed fleet) | Calculate gross, fee, insurance, fuel advance, escrow, maintenance and other deductions; notify fleet; acknowledge/dispute window; carrier approves and pays | Carrier | R3 |
| AUT-051 | Fleet disputes a line | Freeze that line; open case; notify carrier; resume on resolution | Carrier / Platform | R3 |
| AUT-052 | Fleet settlement paid | Notify fleet; fleet pay run for its drivers (its own model) | Fleet | R3 |

## 2.6 Platform operations

| ID | Trigger | Automated actions | Owner | Rel |
|---|---|---|---|---|
| AUT-060 | Any failed job, failed payment, returned payment | Create case with context; notify operator; retry policy | Platform | R1/R4 |
| AUT-061 | Cases | Auto-route by category; SLA timers; "Waiting on user" nudges | Platform | R4 |
| AUT-062 | Platform fees / subscription period end | Compute usage, invoice carrier, track payment | Platform | R4 |
| AUT-063 | Cross-tenant access by staff | Require elevated permission and reason code; alert on unusual patterns | Platform | R1 |
| AUT-064 | Backup, restore test, secret rotation, dependency scan | Scheduled with reports | Engineering | R1 |

# 3. Advanced automation scenarios

These add inference or optimisation. **All are assistive: they recommend or draft, a person confirms, and every output is explainable and logged.** Each needs an opt-in switch, accuracy tracking and a fallback to the rule-based flow. They are internal capabilities and must not be described on public pages (IP boundary).

| ID | Scenario | How it works | Human control | Rel |
|---|---|---|---|---|
| ADV-001 | **Rate-confirmation intake** | Email/PDF received → extract broker, stops, appointments, rate, commodity, terms → create draft load and, if unknown, a draft broker | Dispatcher reviews every field before activation | R1/R2 |
| ADV-002 | **Document recognition** | Photos of CDL, medical card, insurance, registration, BOL, POD, receipts → classify, extract expiry and numbers, check legibility and completeness | Reviewer confirms; low confidence goes to manual | R1 |
| ADV-003 | **Driver–load matching suggestions** | Rank eligible drivers/trucks by location, hours availability, equipment type and size, compliance, ownership rules, history | Dispatcher picks; reasons shown | R2 |
| ADV-004 | **ETA and delay prediction** | Combine route, traffic, stops, dwell history of each facility → predict lateness early | Alerts and draft notices only | R2 |
| ADV-005 | **Facility intelligence** | Learn dock hours, dwell and detention patterns per shipper/receiver; suggest realistic appointment windows | Advisory | R2 |
| ADV-006 | **Settlement anomaly detection** | Compare drafts with history and fixtures: sudden deltas, duplicated deductions, wrong-week loads, missing escrow, negative nets | Blocks approval until reviewed | R2 |
| ADV-007 | **Payment reconciliation** | Match bank/factor remittances to invoices (amount, reference, partials, short pays) | Accountant confirms unmatched or low-confidence | R2 |
| ADV-008 | **Credit and collections prompts** | Days-to-pay trends per broker → suggest follow-ups, draft reminder emails | Accounting sends | R2 |
| ADV-009 | **Fraud and risk signals** | Duplicate VIN/EIN/bank account, mismatched identity documents, impossible locations, load re-tender patterns, remit-to changes on factoring | Raises case; never auto-blocks money | R2/R4 |
| ADV-010 | **Maintenance forecasting** | Predict service due from mileage, history and duty cycle beyond the fixed interval | Advisory | R3 |
| ADV-011 | **Dynamic compliance forecasting** | Forecast which drivers/trucks will become ineligible in 30 days and what that does to booked loads | Planner view | R2 |
| ADV-012 | **Natural-language operations assistant** | "Show late loads for broker X", "Why is Jim's settlement lower?" → read-only answers with sources, permission-scoped; actions are drafted for confirmation | Read-only by default | R4 |
| ADV-013 | **Summaries and drafts** | Shift handover, exception summaries, broker updates, case summaries | Always edited/approved | R2 |
| ADV-014 | **Self-healing integrations** | Detect webhook drift, expired tokens, schema changes and provider outages; switch to fallback (e.g. manual capture); open case | Operator notified | R2 |
| ADV-015 | **Workflow builder (per carrier)** | Carriers configure rules inside platform limits (thresholds, templates, quiet hours) where Platform Admin permits overrides | Platform guardrails | R4 |

Guardrails: confidence thresholds with manual review below them; no model sees SSN, bank numbers or ID images unless a reviewed, contractually covered vendor is chosen; prompts and outputs retained in audit without sensitive fields; measure precision/recall per scenario before enabling.

# 4. Third-party integration end-to-end scenarios

Format: trigger → flow → system of record → failure handling → E2E test. Provider names are options, not selections.

## INT-01 Maps, geocoding, routing and geofencing
- **Flow:** facility saved → geocode → store coordinates and time zone → load created → route miles computed → driver app navigates → geofence events → StopEvent → miles driven/left recalculated.
- **Record:** I-way database (provider results cached within licence terms).
- **Failure:** geocode miss → manual pin; provider outage → cached route, manual arrival confirm; quota exhaustion → alert, throttle.
- **Test:** sandbox addresses incl. ambiguous city names; simulated GPS track enters/leaves geofence; offline arrival confirmation syncs later without duplicates.

## INT-02 ELD / GPS telematics
- **Flow:** carrier links ELD account (OAuth/API key) → vehicle mapping by VIN/unit → position, odometer and HOS summaries ingested → dispatch board and tracking link update → odometer feeds service intervals.
- **Failure:** stale feed > threshold → mark "last seen"; unmapped vehicle → onboarding task; revoked credentials → reconnect prompt and case.
- **Test:** mock provider replays a trip; mismatch between driver-app GPS and ELD handled by precedence rule [TBC].

## INT-03 Push, email and SMS
- **Flow:** domain event → notification engine → preference and quiet-hours check → channel send → delivery receipt/webhook → status stored → fallback channel on failure.
- **Failure:** bounce/complaint → suppress and flag contact; SMS opt-out honoured; template missing → case.
- **Test:** each event type per channel; broker pickup/delivery email with POD attachment; opt-out and bounce handling; rate-limit burst.

## INT-04 Factoring company
- **Flow:** load factored → invoice packet → submit by email, portal or API (per company) → schedule of accounts created → advance and reserve recorded → notice of assignment sent to broker → remittance received → matched to invoices → reserve release.
- **Record:** I-way invoices and FactoringSchedule; factor is system of record for advance and fee.
- **Failure:** rejection → reason captured, load flagged; remit-to change → fraud callback check (ADV-009); partial funding → status Partially Paid.
- **Test:** factored vs. non-factored routing; batch submission; short pay; chargeback; remit-to change alert.

## INT-05 Banking and payments (driver, owner and fleet payouts)
- **Flow:** bank details collected (masked, tokenised) → verification (micro-deposit or instant) → approved settlement → payment instruction created (idempotent) → provider processes → status webhook → Paid, Failed or Returned → payee notified → ledger entry.
- **Failure:** return/NSF → settlement Failed/Returned, case opened, payee notified, no auto-retry without approval; webhook missed → reconciliation poll.
- **Test:** sandbox success, failure and return codes; duplicate webhook; approval of payout requires the right role; amounts equal approved PDF.

## INT-06 Accounting export (e.g. QuickBooks)
- **Flow:** approved invoices, payments and settlements → mapped chart of accounts → push or scheduled export → sync status and external IDs stored.
- **Failure:** mapping missing → hold and task; period closed externally → adjustment entry flag.
- **Test:** round-trip totals equal I-way reports for a pay week; re-run produces no duplicates.

## INT-07 Fuel cards and expense feeds (e.g. fuel-card imports referenced in v1)
- **Flow:** transaction file/API → match to truck/driver → classify as deduction, advance or reimbursement → appear in draft settlement → show on statement.
- **Failure:** unmatched card → queue; duplicate transaction → ignore by key; date outside week → carrier cut-off rule.
- **Test:** each deduction applies once per week; fixture reproduces a known fuel deduction amount.

## INT-08 Carrier and broker verification (FMCSA authority, credit services)
- **Flow:** MC/DOT entered → authority and status lookup → bond/insurance data stored → approval gate → periodic re-check (monthly) → alert on revocation.
- **Failure:** service unavailable → manual attestation with expiry; mismatch → flag.
- **Test:** active, inactive and revoked sample numbers; scheduled re-check changes status and blocks new loads for that broker.

## INT-09 Driver screening and compliance services (MVR, Clearinghouse, drug-test results)
- **Flow:** consent captured → order via provider → result received → stored with restricted access → reviewer decision → eligibility updated.
- **Failure:** consent missing → block; result late → reminder; adverse result → process per counsel guidance [TBC].
- **Test:** consent-gated order; access control on results; audit of every view.

## INT-10 Insurance and document verification
- **Flow:** certificate uploaded or retrieved → extract/verify limits and dates → attach to carrier, fleet, truck → expiry automation (AUT-010).
- **Failure:** unreadable or mismatched policy → manual review.
- **Test:** expired, near-expiry and valid certificates drive correct eligibility.

## INT-11 VIN decoding and equipment data
- **Flow:** VIN entered → decode year/make/model/type → prefill vehicle → duplicate VIN check → owner linkage.
- **Failure:** decode fails → manual entry; ownership transfer only through audited process (BR-009).
- **Test:** valid, invalid and duplicate VINs.

## INT-12 E-signature
- **Flow:** in-app drawn signature for BOL/POD (driver, shipper, receiver) captured with timestamp and geolocation → embedded in PDF → stored immutable → hash recorded. For agreements (driver agreements, fleet management agreements) use the same capture or an external e-sign provider [TBC].
- **Failure:** signature refused by receiver → exception with photo; offline → queue and sign later with evidence.
- **Test:** multi-stop signatures; PDF hash unchanged after delivery to broker; audit of capture context.

## INT-13 Identity, SSO and device trust
- **Flow:** staff sign in through company SSO (optional) → MFA → device registration for drivers (PIN/biometric) → token refresh → revoke on termination.
- **Failure:** IdP outage → break-glass admin path with audit.
- **Test:** role change propagates; revoked driver cannot open session; tenant claim cannot be spoofed.

## INT-14 Analytics and BI
- **Flow:** governed events/warehouse export (no sensitive fields) → dashboards (carrier performance, AR aging, dispatcher performance) → scheduled reports.
- **Test:** report totals equal operational screens; masked columns stay masked.

## INT-15 Public site early-access intake (R0)
- **Flow:** form → HTTPS endpoint → validation, spam control → lead store/CRM → acknowledgement email → follow-up task. Public page shows only the outcome.
- **Failure:** endpoint down → form shows retry, inputs preserved; consent text versioned.
- **Test:** valid/invalid payloads; no PII in analytics events; preview mode never claims success.

# 5. Full end-to-end journeys

| Journey | Steps across systems | Pass condition |
|---|---|---|
| **E2E-1 Onboard to dispatch-ready** | Invite (INT-03) → driver app onboarding with documents (ADV-002) → screening (INT-09) → carrier approval → eligibility = Yes | Driver appears assignable only after all blocking items valid |
| **E2E-2 Rate-con to delivered** | Email rate-con (ADV-001) → draft load → assign (AUT-021) → accept → geofence arrival (INT-01) → signed BOL (INT-12) → tracking (INT-02) → delivery and POD → broker emails (INT-03) | Statuses, timestamps, documents and notices all present and consistent |
| **E2E-3 Delivered to cash** | Invoice packet (AUT-040) → factoring (INT-04) or broker → payment recorded/reconciled (ADV-007) → accounting export (INT-06) | Invoice Paid; totals equal in I-way, factor and accounting |
| **E2E-4 Pay week to payout** | Week open (AUT-044) → fuel feed (INT-07) → settlement drafts (AUT-045) → anomaly scan (ADV-006) → approval → statement → payout (INT-05) → ledger | Net equals formula; deduction once per week; payout equals approved PDF |
| **E2E-5 Managed fleet** | Fleet invite → agreement e-sign (INT-12) → fleet drivers/trucks approved → load runs → fleet settlement → dispute → resolution → carrier pays → fleet pays its drivers | Both settlement layers reconcile; driver sees only own pay |
| **E2E-6 Failure and recovery** | Provider outage (maps, ELD, payments) → fallback path → case → recovery → reconciliation | No lost or duplicated records |

# 6. Integration engineering patterns

- **Adapter per provider** behind a stable internal interface; swap vendors without changing domain modules.
- **Webhooks:** verify signatures, store raw payload, process asynchronously, respond fast, dedupe by event id.
- **Idempotency keys** on every outbound money or message call.
- **Sandbox + contract tests** per provider; nightly smoke tests against sandboxes; recorded fixtures for CI.
- **Reconciliation jobs** for payments, factoring remittances, ELD odometer and notification delivery.
- **Credentials:** per-tenant secrets in a secrets manager; rotation; scoped least-privilege API keys; never in logs.
- **Observability:** per-integration health, latency, error rate, quota; alerts to Platform operations.
- **Data minimisation and retention** per provider contract and legal review [TBC OQ-08].
- **Test data:** synthetic only; never real SSNs, bank or ID data in fixtures.

# 7. Suggested sequencing

| Release | Automation focus | Integrations |
|---|---|---|
| R0 | INT-15 | Early-access intake, email acknowledgement |
| R1 | AUT-001–034, 060, 063, 064; ADV-001/002 (assistive) | Maps/geofence, messaging, e-signature capture, FMCSA/VIN lookups, screening (as approved), ELD pilot |
| R2 | AUT-040–049; ADV-003–009, 011, 013, 014 | Factoring, banking/payments, accounting export, fuel cards, BI |
| R3 | AUT-050–052; ADV-010 | Agreement e-sign, fleet payouts |
| R4 | AUT-061, 062; ADV-012, 015 | SSO, platform billing, advanced monitoring |

# 8. Open decisions

Vendor selection per integration; ELD/GPS precedence rule; legal basis for screening and sensitive data; AI vendor data-handling terms; which advanced scenarios are in scope for R1 versus R2; payout rails and who bears returned-payment cost.
