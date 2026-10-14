---
title: "I-way — Business Requirements Document"
subtitle: "Business case, scope and requirements"
date: "October 10, 2026"
---

**Classification: INTERNAL — CONFIDENTIAL. Not for the public website or any publicly accessible folder.**

| | |
|---|---|
| Document | Business Requirements Document (BRD) |
| Product | I-way |
| Version | 1.0 — draft for review |
| Date | October 10, 2026 |
| Companion | PRD (docs/PRD.md) |
| Basis | Brand Kit, public-experience directive, landing-page prototype, Logistics App Design (Make file) with its embedded proposal, rebuild documentation and style-guide proposal |

All figures below are either taken from the source material or marked **[TBC]**. No financial projections, pricing or dates are invented.

# 1. Executive summary

I-way is a connected logistics platform for trucking operations. It joins four applications — a Driver Mobile App, a Carrier Admin Portal, a Fleet Company Portal and an I-way Platform Admin — around one rule: every business function has a single owner, and every other party can only view, submit, request, approve or monitor it.

It replaces and extends iWay Dispatch v1, a production dispatch and TMS platform whose operation has been hampered by inaccurate settlements, pay-week errors, slow performance and a lack of self-service correction tools, and whose mobile source code no longer exists. A public website under the I-way brand introduces the product and collects early-access interest without disclosing internal strategy or technology.

The business case rests on four outcomes: dependable money handling (settlements and invoices), faster and safer dispatch, lower compliance risk, and an owned, maintainable platform.

# 2. Business problem and opportunity

| Problem (source: v1 known issues and master requirements) | Business impact |
|---|---|
| Settlement and pay-week calculation errors (deductions counted twice, loads in the wrong week, negative or zero amounts) | Payee disputes, manual corrections, financial risk |
| No self-service tools to edit, void, move or reassign records | Dependence on a developer for routine fixes |
| Slow pages and outages on undersized hosting | Lost productivity; failure to void an invoice during an outage |
| Mobile apps cannot be maintained (no source) | Driver experience frozen; new features impossible |
| Carrier-owned drivers and fleet-company drivers are not distinguished; fleet-company business model unsupported | Cannot serve managed-fleet carriers |
| Unclear permissions between parties | Duplication, disputes, data-exposure risk |
| No brand-consistent public presence | Weak trust and conversion for new prospects |

**Opportunity.** Support two carrier operating models at once — Carrier Fleet and Managed Fleet — on one platform, with auditable money flows and one driver app for every driver.

# 3. Business objectives

| ID | Objective | Measure | Target |
|---|---|---|---|
| BO-1 | Accurate settlements | Settlement corrections requiring developer action; disputed settlements per pay week | Baseline from v1 history; target **[TBC]** |
| BO-2 | Faster dispatch | Time from load creation to driver acceptance | Baseline then target **[TBC]** |
| BO-3 | Compliance control | Expired documents on dispatch-eligible drivers and equipment | Zero by rule (BR-020); monitored |
| BO-4 | Faster cash collection | Invoice-to-payment days; invoices without recorded payment status | Baseline from v1 days-to-pay report; target **[TBC]** |
| BO-5 | Self-service operations | Share of routine corrections performed by users with audit | **[TBC]** |
| BO-6 | Early-access demand | Early-access submissions; Get Started click-through | Set after first measurement period **[TBC]** |
| BO-7 | Owned platform | Source, repositories, database, domain, store accounts and design files company-owned | Complete at handover |

# 4. Stakeholders

| Stakeholder | Interest |
|---|---|
| Executive sponsor / product owner | Strategy, scope, release decisions |
| Carrier management | Operational control, compliance, profitability |
| Dispatchers | Daily load workflow |
| Accounting | Invoices, factoring, settlements, escrow |
| Drivers (carrier, fleet, owner-operator) | Simple execution, accurate pay |
| Fleet companies | Fleet control, driver pay, fair settlement |
| I-way platform operations | Onboarding, support, governance |
| Brokers, shippers, receivers | Timely notices, documents, tracking links |
| Factoring companies | Invoice submission, remittance reconciliation |
| Design and engineering vendors | Clear scope and handover |
| Legal and compliance | Privacy, terms, data handling, regulated documents |

Named participants in the supplied material include the product-strategy attendees and the documentation author; sign-off names are to be completed in §14.

# 5. Scope

## 5.1 In scope
1. Public website with early-access capture and sign-in chooser (R0).
2. Driver Mobile App and Carrier Admin Portal for the driver–dispatcher relationship (R1: onboarding, equipment, customers/brokers, load creation and dispatch, execution, documents, compliance, notifications, audit).
3. Money: invoicing, factoring submission, payment tracking, pay weeks, settlements, escrow, driver earnings, reports (R2).
4. Fleet Company Portal, management agreements, fleet settlements, driver pay and fleet escrow (R3).
5. Full Platform Admin: carrier lifecycle, cases, billing, risk, configuration, payment monitoring (R4).
6. Migration from iWay Dispatch v1 and company ownership of all assets.

## 5.2 Out of scope (for this BRD)
Broker/shipper self-service portal; committed pricing and dates; tax reporting enhancements and expanded carrier performance dashboards (marked "possibly roadmap" in the proposal); ELD, fuel-card and accounting integrations beyond scoping; any public disclosure of internal strategy or technology.

## 5.3 Assumptions
- The initial release covers the driver–dispatcher relationship only (October 3, 2026 meeting); the four-app MVP in the master requirements is the longer-term target.
- Brand Kit tokens supersede the earlier style-guide proposal.
- The platform stack is chosen through ADRs; v1 stack (Angular, .NET, SQL Server) is not binding.
- Brokers, shippers, receivers, factoring companies and truck owners are records (and recipients of notices), not logged-in users, until a later release.

## 5.4 Constraints
- Tenant isolation between carriers and between fleet companies is mandatory (BR-010, BR-011).
- Sensitive data (SSN, ID, bank, tax) requires legal review and strict handling before collection.
- The public site must keep a strict information boundary (directive §1).
- The earlier five-month estimate does not apply to this scope.

# 6. Business requirements

| ID | Business requirement | Priority | Release | Traces to |
|---|---|---|---|---|
| BRQ-01 | The business shall present I-way publicly with a credible, brand-consistent website that converts visitors to early-access leads without revealing proprietary strategy, algorithms or architecture. | Must | R0 | PRD §13 |
| BRQ-02 | The platform shall let a carrier onboard, approve and manage its own drivers, trucks, owners, brokers, customers and factoring companies. | Must | R1 | FR-CAR-009 to 016, 019 |
| BRQ-03 | The platform shall let carriers create, assign, dispatch, track, edit, void and complete loads, with multi-stop support. | Must | R1 | FR-CAR-002 to 007 |
| BRQ-04 | The platform shall give every driver one mobile app to accept loads, confirm stops with location assistance, capture signed BOL/POD, report exceptions and keep documents valid. | Must | R1 | FR-DRV |
| BRQ-05 | The carrier shall hold final authority over dispatch eligibility and compliance for everything operating under its authority. | Must | R1 | BR-005, BR-020 |
| BRQ-06 | Brokers shall be notified by email on pickup and delivery and receive driver-captured documents, and may receive a live tracking link. | Must | R1 | FR-CAR-004, 008 |
| BRQ-07 | The platform shall produce accurate, auditable driver and owner settlements by pay week, including escrow, with preview, approval, PDF statements and audited un-approval. | Must | R2 | FR-CAR-021, 022, §12.4 |
| BRQ-08 | The platform shall generate invoices from completed loads, assemble the invoice packet, submit to broker or factoring company, and track payment (manual and integrated). | Must | R2 | FR-CAR-023, 024 |
| BRQ-09 | Drivers shall see their earnings and settlement history with PDF statements appropriate to their driver type. | Must | R2 | FR-DRV-019 |
| BRQ-10 | The platform shall support managed fleets: fleet companies, management agreements, carrier-calculated fleet settlements, fleet-controlled driver pay and escrow ledgers. | Must | R3 | FR-CAR-026, 027, FR-FLT |
| BRQ-11 | I-way staff shall onboard and support carriers with governed, audited cross-tenant visibility and no carrier dispatch authority. | Must | R1 / R4 | FR-ADM |
| BRQ-12 | Every financial, compliance, dispatch, access and status-changing action shall be auditable. | Must | R1 | BR-012 |
| BRQ-13 | The business shall own the source code, repositories, database, domain, app-store accounts, design files and secrets. | Must | R1 | PRD §15, §17 |
| BRQ-14 | The platform shall meet agreed performance, availability and backup targets. | Should | R1 | PRD §15 |
| BRQ-15 | The business shall migrate from v1 with side-by-side settlement runs before cut-over. | Should | R2 | PRD §17 |

# 7. Business rules

The twenty rules BR-001 to BR-020 in the PRD (§5.5) are binding business rules. In summary: single ownership of each function; carrier authority over loads, dispatch and eligibility; driver execution without commercial control; fleet company control of its own drivers' employment and pay; carrier calculation of fleet settlements; platform governance without dispatch; explicit equipment ownership; strict tenant and fleet isolation; mandatory audit; deactivate-not-delete; UTC storage with carrier-time-zone evaluation; once-per-week deductions; system-calculated escrow; factored invoices payable to the factor.

# 8. Key business processes

## 8.1 Load to cash (carrier driver)
Broker rate confirmation received → load created by dispatcher (customer/broker, stops, rate, billing) → driver and truck assigned → driver accepts → pickup (arrival, BOL signed) → transit → delivery (arrival, receiver signs, POD) → broker notified with documents → carrier reviews and completes → invoice generated and packet assembled → sent to broker or factoring company → payment recorded → load included in the pay week by first pickup date → driver and owner settlements previewed, approved, issued as PDF.

## 8.2 Managed fleet
Carrier invites and approves fleet company → management agreement signed → fleet adds trucks and drivers → carrier approves them for dispatch → loads run on fleet equipment → carrier calculates fleet settlement (gross, management fee, insurance, fuel advance, escrow, maintenance and other deductions, adjustments) → fleet reviews, acknowledges or disputes → carrier resolves, approves and pays → fleet pays its drivers per its own pay model.

## 8.3 Onboarding
Started by manager, dispatcher, fleet company or invitation → details and documents → verification → approval by the responsible owner → active only when all blocking items are valid. Records in Draft or Needs Changes stay invisible to dispatch and accounting.

## 8.4 Compliance
Documents carry expiry dates; reminders at configurable intervals; expiry or rejection of a critical document sets Dispatch Eligible = No until the carrier clears it.

# 9. Commercial model (business level)

The material identifies the following commercial elements without values; values are **[TBC]** and must not appear publicly until approved:

- Platform subscription and platform fees (iWay Admin configuration).
- Carrier-to-fleet management fee, fee calculation method, settlement frequency, escrow requirement and deduction rules (set per Fleet Management Agreement).
- Dispatcher compensation as a percentage of gross load dispatched.
- Factoring advance and fee percentages and recourse terms (per factoring company).
- Driver and owner revenue shares, admin fee and fixed deductions (per vehicle financial settings).

# 10. Compliance and risk considerations

The material references CDL, DOT medical certificate, MVR, FMCSA authority checks, annual DOT inspection, Form 2290, W-4/W-9, direct-deposit forms, pre-employment drug screening and Clearinghouse queries. Applicability, retention periods and legal basis for each must be confirmed by counsel before collection. **[TBC OQ-08]**

| Business risk | Likelihood / impact | Response |
|---|---|---|
| Scope outgrows capacity | High / High | Phased releases, re-estimation |
| Financial calculation defects | Medium / High | Fixtures, preview, audited un-approve |
| Data exposure across tenants | Low / Very high | Layered authorization and isolation tests |
| Loss of control of assets again (as with v1 mobile source) | Medium / High | Company-owned repos and accounts from day one |
| Public claims exceed capabilities | Medium / High | Verified-capability copy rule; review gate |
| Vendor or handover delays | Medium / Medium | Handover checklist tracked to completion |

# 11. Success criteria and acceptance

- Public website passes the directive's acceptance criteria and IP-disclosure review.
- A carrier completes onboarding, dispatch and delivery of a load end to end (R1 exit).
- Settlement fixtures pass and two parallel pay weeks reconcile with v1 (R2 exit).
- A fleet company's driver completes a load and both settlement layers reconcile (R3 exit).
- Operators resolve a case without developer help (R4 exit).

# 12. Dependencies

Counsel-approved privacy policy and terms; approved contact details and commercial copy; a sign-up service for early access; selection of maps, messaging, payments and factoring integrations; completion of the v1 handover; engineering ADRs; legal guidance on regulated and sensitive data.

# 13. Open decisions

See PRD §20 (OQ-01 to OQ-12). The three that most affect business commitments are release boundaries (OQ-01), sensitive-data handling (OQ-08) and approved commercial copy (OQ-07).

# 14. Approvals

| Role | Name | Decision | Date |
|---|---|---|---|
| Executive sponsor | | | |
| Product owner | | | |
| Finance / accounting lead | | | |
| Legal / compliance | | | |
| Engineering lead | | | |
| Marketing / brand | | | |

# Appendix — Traceability to sources

| Business requirement | Source |
|---|---|
| BRQ-01 | Directive §1–§7; Brand Kit; prototype index.html |
| BRQ-02 to BRQ-06 | Master requirements §4–§26; Make refinements |
| BRQ-07 to BRQ-09 | Master requirements §12, §26; Rebuild Documentation (settlements, invoicing); Make refinements |
| BRQ-10 | Master requirements §16–§17, §27–§35 |
| BRQ-11 | Master requirements §36–§42 |
| BRQ-12 to BRQ-15 | Master requirements §44, §48; Rebuild Documentation (known issues, architecture, handover) |
