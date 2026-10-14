---
title: "I-way — Product Requirements Document"
subtitle: "Four-application ecosystem and public conversion website"
date: "October 10, 2026"
---

**Classification: INTERNAL — CONFIDENTIAL. Do not publish, deploy or place in any publicly accessible folder.**

| | |
|---|---|
| Document | Product Requirements Document (PRD) |
| Product | I-way |
| Version | 1.0 — draft for review |
| Date | October 10, 2026 |
| Companion | BRD (docs/BRD.md), Architecture (docs/ARCHITECTURE.md) |
| Status | Draft. Items marked **[DECISION]** or **[TBC]** need owner confirmation. |

# 1. Purpose and source basis

This PRD defines what I-way must do for its users and what the first releases include. It is written strictly from the material supplied for this design pass:

| Source | What it contributes |
|---|---|
| **I-way Brand Kit** (logo, icon, tokens, preview) | Brand identity: Navy #092448, Blue #1261F3, Cyan #00BCE8, Orange #FF681C, Amber #FFB000, Cloud #F5F8FC, Ink #111827; Inter; radii 20px card / 12px button. |
| **Public Experience & Conversion Design Directive** | Public website scope, structure, copy limits, conversion rules, acceptance criteria, and the strict public/private information boundary. |
| **Landing-page prototype (index.html)** | Starting copy and layout. Replaced where it conflicted with the directive (see §2.2). |
| **Logistics App Design (Figma Make file)** | Master Product Requirements v2.0 (four applications, ownership model, responsibility matrix, business rules BR-001 to BR-012, statuses, notifications, permissions), the universal Driver App rule, and about 100 refinement requests that shaped the working prototype (load creation, assignment, onboarding, settlements, invoicing, geofence prompts, e-signature, dispatcher management, service intervals). |
| **Documents embedded in the Make file** | Project proposal, Rebuild Documentation (v1 history, rules, known issues, settlement formulas, onboarding gates), UI design and a v1 style-guide proposal. |

Nothing in this PRD relies on facts outside those sources. Where the sources conflict or are silent, the conflict is listed in §2 or §20 rather than silently resolved.

# 2. Reconciliations and decisions made in this draft

## 2.1 Naming
The brand kit names the product **I-way**. The Make prototype and master requirements say "iWay". The existing production product is "iWay Dispatch" (v1). **This PRD uses "I-way" for the product and brand, and "iWay Dispatch v1" for the legacy system.** [DECISION D-01]

## 2.2 Public site vs. prototype landing page
The prototype landing page in the Make file exposes internal material (a "Platform Admin" entry, a hierarchy diagram, epic and business-rule counts). The directive forbids this on the public site. **The public website is therefore a separate deliverable (site/public) that shows customer outcomes only.** The prototype's four-app entry-point screen is retained only as an internal reference, not as public content.

The supplied index.html also showed numbers such as "1,248 shipments", "98% on-time" and a "Live concept" label. These read as operational statistics and are removed. The new page uses clearly labelled illustrative sample data only.

## 2.3 Palette conflict
A v1 style-guide proposal in the Make file uses an asphalt / highway-blue / amber palette and states that no brand colours had been agreed. The **I-way Brand Kit supersedes it**. The Make prototype uses a dark amber theme that also predates the brand kit; re-theming it to the kit is a requirement (FR-DS-01). [DECISION D-02]

## 2.4 Release scope
The Make master requirements propose a four-application MVP. Per the October 3, 2026 product-strategy follow-up, the **initial release is the driver–dispatcher relationship only**. This PRD phases the ecosystem accordingly (§6) and keeps every Make requirement, assigned to a release. The master document itself warns that its five-month estimate belonged to a narrower design-only scope and should not be reused. **No delivery dates are committed here.** [DECISION D-03 — confirm release boundaries]

## 2.5 Existing platform
iWay Dispatch v1 is in production (web portal plus iOS and Android driver apps) with a documented list of failures: settlement accuracy, pay-week logic, performance, and missing self-service corrections. The proposal lists React/React Native, Node.js and MongoDB; the Rebuild Documentation records v1 as Angular, .NET and SQL Server and leaves v2 stack choice to the vendor. **The stack is therefore open and must be settled in an architecture decision record (ADR-001)** before build. [DECISION D-04]

# 3. Vision, goals and non-goals

**Vision.** One connected logistics experience in which every party sees the same truth about a load and each function has exactly one owner.

**Product goals**

1. Give drivers one simple app to execute work, capture documents and see pay, whoever employs them.
2. Give carriers a single command centre for dispatch, compliance and money.
3. Let fleet companies run their own trucks, drivers and driver pay without becoming carrier administrators.
4. Give I-way staff governed, audited visibility to operate the platform.
5. Present I-way publicly as a polished, trustworthy brand that converts visitors to early-access sign-ups without disclosing proprietary design.

**Non-goals (this PRD)**

- No committed pricing, delivery dates, certifications, SLAs, customer logos or testimonials.
- No broker or shipper self-service portal (brokers receive email notifications and tracking links; a portal is a later option).
- No public disclosure of strategy, algorithms, architecture, settlement formulas or roadmap.
- No change to iWay Dispatch v1 operations; migration is covered as a release stream (§17).

# 4. Personas

| Persona | Application | Core job | Key constraint |
|---|---|---|---|
| **Driver** (carrier driver, fleet-company driver, owner-operator) | Driver Mobile App | Accept and complete loads, capture BOL/POD, keep documents valid, see pay | Gloves, cabs and weak signal: large targets, offline-tolerant actions, manual fallbacks |
| **Dispatcher** | Carrier Admin | Create, assign and track loads; notify brokers | Needs live status and no ambiguity about who is eligible |
| **Carrier manager / admin** | Carrier Admin | Master data, approvals, compliance authority, settlements | Single authority for dispatch eligibility |
| **Accounting** | Carrier Admin | Invoices, factoring, pay weeks, settlements, escrow | Accuracy and audit above speed |
| **Fleet administrator** | Fleet Company Portal | Own trucks, drivers, maintenance and driver pay | Cannot approve own drivers for carrier operations |
| **I-way platform operator** | Platform Admin | Onboard carriers, monitor, support, configure | Cross-tenant access only with elevated permission and reason code |
| **Public visitor** (business that ships goods) | Public website | Understand value, trust it, join early access | No forced account before understanding the product |
| **Broker / shipper / receiver** (external) | Email, tracking link | Receive pickup/delivery notices, documents, live location | Not a logged-in user in R1–R3 |

# 5. Ecosystem and ownership model

## 5.1 Applications and primary responsibility

| Application | Primary responsibility |
|---|---|
| Driver Mobile App | Execute assigned transportation work |
| Carrier Admin Portal | Operate the trucking/carrier business |
| Fleet Company Portal | Manage owned trucks, drivers and the financial relationship with the carrier |
| I-way Platform Admin | Govern and operate the platform |

## 5.2 Principle: one owner per function
Every major function has one primary owner. Other applications may **View, Submit, Request, Approve or Monitor** but never independently control it. Example: a Fleet Company adds a driver; the driver completes information; the Carrier reviews and approves; the driver becomes dispatch eligible. A Fleet Company never approves its own driver for carrier operations.

## 5.3 Universal Driver App (DR-MOB-001)
One Driver App serves all driver types. The backend resolves the relationship after sign-in (driver type, carrier, fleet company, payment responsibility). Differences are data and permissions, not separate apps.

| Driver type | Managed by | Paid by |
|---|---|---|
| Carrier driver | Carrier | Carrier |
| Fleet-company driver | Fleet company, with carrier operational oversight | Fleet company |
| Owner-operator | Per carrier agreement | Per agreement |

## 5.4 Responsibility matrix
Legend: **O** own/control, **M** manage/submit, **A** approve, **V** view, **—** none. (\* limited visibility.)

| Function | Driver | Carrier | Fleet Co. | Platform |
|---|---|---|---|---|
| Execute load | O | M | V | V |
| Create load | — | O | — | V |
| Assign load | Accept/Reject | O | — | V |
| Carrier driver creation | M | O/A | — | V |
| Fleet driver creation | M | A | O/M | V |
| Driver compliance approval | Submit | O/A | M | V |
| Fleet truck creation | — | A | O | V |
| Carrier truck creation | — | O | — | V |
| Dispatch eligibility | — | O | — | V |
| Customer / broker management | — | O | — | V |
| Carrier load rate | — | O | — | V |
| GPS / load tracking | M | O | V | V |
| POD submission | O | M/A | V | V |
| Carrier driver settlement | V | O | — | V |
| Fleet settlement | — | O | V/Dispute | V |
| Fleet driver pay | V | — | O | V\* |
| Carrier escrow | V | O | — | V |
| Fleet escrow | — | O | V/Dispute | V |
| Fleet maintenance | — | V/A\* | O | V |
| Carrier maintenance | — | O | — | V |
| Carrier onboarding | — | M | — | O/A |
| Fleet company onboarding | — | O/A | M | V |
| Carrier user management | — | O | — | V |
| Fleet user management | — | — | O | V |
| Platform user management | — | — | — | O |
| Platform configuration | — | — | — | O |

## 5.5 Business rules

| ID | Rule |
|---|---|
| BR-001 | Only the Carrier can create and commercially manage Carrier loads. |
| BR-002 | Only authorized Carrier users can assign or reassign loads. |
| BR-003 | Drivers execute assignments but cannot modify commercial load terms. |
| BR-004 | The Fleet Company manages its drivers' employment and pay relationship. |
| BR-005 | The Carrier has final authority over whether any driver or equipment may operate under it. |
| BR-006 | The Carrier calculates and approves payments owed to Fleet Companies. |
| BR-007 | The Fleet Company controls payment to its own drivers. |
| BR-008 | Platform Admin governs the platform but does not perform normal Carrier dispatch. |
| BR-009 | Equipment ownership is explicit and changes only through an audited ownership-transfer process. |
| BR-010 | One Carrier cannot access another Carrier's operational or financial information. |
| BR-011 | One Fleet Company cannot access another's drivers, equipment, loads, earnings or settlements. |
| BR-012 | Financial, compliance, dispatch, user-access and status-changing actions generate audit events. |

Additional rules carried from the Rebuild Documentation and prototype refinements:

| ID | Rule |
|---|---|
| BR-013 | A load has one broker (or a direct paying customer), at least one pickup and one delivery stop, and at most one active driver and vehicle assignment. Reassignment ends the previous assignment. |
| BR-014 | A vehicle has exactly one owner and at most one assigned driver at a time. |
| BR-015 | Master records are deactivated, not hard-deleted. Loads and invoices are voided, not deleted. |
| BR-016 | Times are stored in UTC and evaluated in the carrier's time zone. A load belongs to the pay week containing its first pickup date in that zone. |
| BR-017 | Each settlement deduction applies once per payee per pay week. Approved settlements are immutable except through an audited un-approve with reason. |
| BR-018 | Escrow progress is system-calculated from approved settlements and is never manually editable. |
| BR-019 | A factored load's invoice is payable to the factoring company; a non-factored load bills to the broker/customer. |
| BR-020 | Critical non-compliance sets Dispatch Eligible = No. |

# 6. Release plan

| Release | Theme | Contents | Exit criteria |
|---|---|---|---|
| **R0** | Public presence | Public website, early-access capture, sign-in chooser, brand tokens, IP-disclosure review | Directive acceptance criteria met (§14); legal pages approved; sign-up service connected |
| **R1** | Driver–dispatcher core (initial release) | Identity and RBAC; minimal platform operations to create carrier tenants; carrier onboarding of drivers, equipment, customers and brokers; load create/assign/dispatch; Driver App execution, documents, geofence, BOL/POD; notifications; audit | A carrier can onboard a driver and truck, dispatch a load, and the driver completes it with POD captured |
| **R2** | Money | Invoicing, factoring submission, payment tracking, pay weeks, driver/owner settlements, escrow, driver earnings and statements, reports | Settlement formulas reproduce agreed fixtures (§12.4); un-approve and audit working |
| **R3** | Fleet companies | Fleet Company Portal, Fleet Management Agreements, fleet settlements, driver pay, fleet escrow, managed-fleet driver flows | A fleet company's driver runs a load and both settlement layers reconcile |
| **R4** | Platform operations at scale | Full Platform Admin: carrier lifecycle, cases, billing, risk, configuration, payment monitoring | Operators resolve cases without developer intervention |

Epics map to releases in §16. The Make master MVP boundary (all four applications) is retained as the long-term target; moving fleet and full admin into R1 would require re-estimation. [DECISION D-03]

# 7. Application requirements

Priority: **P0** must ship in the release, **P1** should, **P2** later. Rel = target release.

## 7.1 Driver Mobile App

| ID | Requirement | Pri | Rel |
|---|---|---|---|
| FR-DRV-001 | Sign in/out, reset password, set/change PIN, biometric sign-in, MFA when triggered, trusted device, notification preferences. Drivers cannot create their own carrier/fleet relationship. | P0 | R1 |
| FR-DRV-002 | Invite-based onboarding: accept invitation, verify phone/email, profile, CDL, emergency contact, employment information requested by the owning company, document upload, agreements, optional banking, submit. | P0 | R1 |
| FR-DRV-003 | Onboarding status visible: Invited → Registration Started → Profile Incomplete → Documents Required → Submitted → Under Review → Approved → Active/Dispatch Eligible; exceptions Needs Information, Rejected, Restricted, Suspended, Inactive. | P0 | R1 |
| FR-DRV-004 | Home: current and next load, status, pickup/delivery appointments, miles remaining, ETA, recent messages, compliance alerts, earnings summary, settlement notification. | P0 | R1 |
| FR-DRV-005 | Receive assignment, view load, accept, or reject with reason. Drivers cannot create, re-rate, reassign or cancel loads. | P0 | R1 |
| FR-DRV-006 | Execution flow per stop: navigate, confirm arrival, loading, loaded, in transit, arrive at delivery, unloading, delivered, POD submitted. With multiple pickups and drop-offs, each stop is confirmed individually. | P0 | R1 |
| FR-DRV-007 | Geofence arrival prompt with a manual "confirm arrival" fallback when the prompt fails (network or location). Prompt must not obscure key load information. | P0 | R1 |
| FR-DRV-008 | Active load screen shows a clear pickup-to-delivery route line including intermediate stops, and a tracking map with truck position. | P0 | R1 |
| FR-DRV-009 | View the rate confirmation as a PDF. | P0 | R1 |
| FR-DRV-010 | Capture BOL at pickup with electronic signatures (drawn signature) by driver and shipper; same document carried to the receiver for signature at delivery; the signed PDF is pushed to the broker and the carrier's load record. | P0 | R1 |
| FR-DRV-011 | Report exceptions (delay, detention, breakdown, accident, cargo, pickup/delivery/route/weather issue, other) with photo, comment, location, timestamp, attachment. | P0 | R1 |
| FR-DRV-012 | Documents: view, upload, replace, submit CDL, medical certificate, MVR where applicable, agreements; load documents (BOL, POD, lumper, scale ticket, fuel/expense receipt). A **Renew** action replaces expired documents. Drivers cannot approve their own documents. | P0 | R1 |
| FR-DRV-013 | Compliance view: Valid, Expiring Soon, Expired, Under Review, Rejected, with configurable reminders (e.g. 60/30/14/7 days). Carrier decides eligibility. | P0 | R1 |
| FR-DRV-014 | See the assigned dispatcher on each load, with chat and call. | P1 | R1 |
| FR-DRV-015 | Assigned truck page populated from the carrier's equipment record, with truck documents (registration/cab card, insurance, annual DOT inspection, lease if applicable). | P1 | R1 |
| FR-DRV-016 | Driver can add truck service information; entries sync with the carrier's truck service history. | P1 | R1 |
| FR-DRV-017 | Service-due prompt when the odometer approaches the carrier-configured service interval, using load distance and driver geolocation while driver and truck are both in service. | P1 | R1 |
| FR-DRV-018 | Profile: direct-deposit information viewable and editable; notification settings, change password and help/support pages functional. | P1 | R1 |
| FR-DRV-019 | Earnings: current week, month-to-date, year-to-date, annual, all-time; load earnings, deductions, escrow, reimbursements, net settlement; previous settlement breakdown with PDF; summary reports (this week, last week, last month, YTD) with PDF. Source depends on driver type; fleet drivers do not see the carrier-to-fleet settlement. | P0 | R2 |
| FR-DRV-020 | Submit expenses against a load. | P1 | R2 |
| FR-DRV-021 | The app is a true mobile application (not a desktop layout in a frame). Offline-tolerant queueing for status, photos and signatures. [DECISION D-05: native vs. cross-platform, see ADR-002] | P0 | R1 |

## 7.2 Carrier Admin Portal

Navigation (from the master requirements; "Asset" combines drivers and equipment per later refinement): Dashboard, Dispatch, Loads, Onboarding, Asset (Drivers, Equipment), Fleet Companies, Customers, Brokers, Factoring, Documents, Compliance, Maintenance, Settlements, Accounting, Reports, Users & Roles, Settings.

| ID | Requirement | Pri | Rel |
|---|---|---|---|
| FR-CAR-001 | Dashboard KPIs: active loads, unassigned, awaiting acceptance, pickups/deliveries today, delayed, available drivers/trucks, compliance exceptions, revenue, settlements payable; fleet breakdown (carrier fleet vs. managed fleet) when R3 is live. | P0 | R1 |
| FR-CAR-002 | **Create load** wizard exactly per the documented flow: (1) customer and broker (inline add; time zone auto-set), (2) pickups and drop-offs with multiple stops, schedule windows and private notes, (3) rate and line items, commodity type, optional dimensions, (4) billing: factored shows factoring company only, non-factored shows Bill To only. Select the responsible dispatcher. | P0 | R1 |
| FR-CAR-003 | Load manager: Active and Completed lists with search; request dates in the carrier's time zone. | P0 | R1 |
| FR-CAR-004 | **Load detail** page: all list fields plus full stop detail, current location, miles driven and remaining (in transit) or total (completed), rate confirmation, driver-uploaded PODs/BOLs/photos, assigned driver and dispatcher, and a control to email a live location/tracking link to the broker contact. | P0 | R1 |
| FR-CAR-005 | Assign/reassign driver and truck; assigning a new load to a driver works end to end; one active assignment per load (BR-013). | P0 | R1 |
| FR-CAR-006 | Dispatch board shows all resources with ownership visible; live-tracking map (US map with truck positions and route lines between pickup and delivery). | P0 | R1 |
| FR-CAR-007 | Edit load in any status with audit; **void** instead of delete; TONU with reason and rate edit. | P0 | R1 |
| FR-CAR-008 | Broker notification emails when a load is picked up and when delivered, to the broker email in the carrier's book of record; a further event sends driver-uploaded BOL/POD documents to that email. | P0 | R1 |
| FR-CAR-009 | **Onboarding hub**: "New" for driver, vehicle, truck owner, broker, customer and factoring company. Queue of in-progress items with working Open and Review actions. Admin-completed onboarding as well as invite-driven onboarding for driver, owner and truck. Draft / needs-changes records stay invisible to dispatch until approved. | P0 | R1 |
| FR-CAR-010 | Broker records support an optional address; factoring company records support an optional address. | P1 | R1 |
| FR-CAR-011 | **Asset** nav with sub-navigation Drivers and Assets. Truck list shows owner of truck; truck details editable. | P0 | R1 |
| FR-CAR-012 | Add-vehicle flow with vehicle types including box truck and reefer and truck size; steps in a left-hand step list with a financial-settings step (revenue share between truck and driver, other deductions). Required truck documents: annual DOT inspection, registration/cab card, lease agreement where needed, insurance. | P0 | R1 |
| FR-CAR-013 | Truck detail: assign or update drivers; edit financial settings in isolation (only that section opens) with the ability to add other deduction lines; document and maintenance cards open only the relevant section on Update. | P0 | R1 |
| FR-CAR-014 | Service intervals: carrier states miles-until-service at truck setup; value carries to truck detail and the driver's truck page; warnings in both when the odometer approaches the interval (FR-DRV-017). Service history entered by admin or driver appears on the truck detail. | P1 | R1 |
| FR-CAR-015 | Driver detail: statuses, full profile and documents (including driver application, W-4, motor vehicle record), edit driver opens Profile + Employment, edit pay + deductions opens only that section with time-stamped edits, escrow summary (total to collect, collected so far; automated, non-editable per BR-018), pay-settlement history with PDF per line. | P0 | R1 / R2 |
| FR-CAR-016 | Driver onboarding progress is visible for invited drivers and adapted for admin-completed onboarding. | P0 | R1 |
| FR-CAR-017 | Dispatcher management: onboard and update dispatchers; payment terms as a percentage of gross load dispatched, editable; onboarding captures required identity and payment information (SSN, ID card, account information) under the sensitive-data rules in §12.3; performance views (week-to-date, last settlement, month-to-date, year-to-date); settlement history with PDF. | P1 | R2 |
| FR-CAR-018 | Compliance: carrier authority over drivers, equipment and fleet companies; document expiry reminders; critical non-compliance sets Dispatch Eligible = No (BR-020). | P0 | R1 |
| FR-CAR-019 | Customer/broker management (customers, shippers, receivers, brokers, rates, payment terms, history). Shippers and receivers are saved facilities. | P0 | R1 |
| FR-CAR-020 | Users & Roles: carrier user management; roles include manager, dispatcher, accounting. | P0 | R1 |
| FR-CAR-021 | **Settlements**: pay-week tabs previous / current / next; move a load to another week (appears in that week's tab); add adjustment; no adjustments on an approved settlement; settlement details visible per payee; search previous settlements and open the approved PDF; preview → approve per payee → PDF → un-approve with reason. | P0 | R2 |
| FR-CAR-022 | Settlement calculation follows §12.4 and the vehicle's financial settings; end to end from load creation through driver completion to settlement. | P0 | R2 |
| FR-CAR-023 | Completed-loads section; **generate invoice** (invoice number format carrier prefix + year + sequence); a review page lists links to POD, rate confirmation and broker-created invoice before sending; download of all three; send to broker or factoring company; final invoice visible from the load manager; manual download for emailing. | P0 | R2 |
| FR-CAR-024 | Payment tracking: record broker/factor payments manually (date, amount, notes) and by integration, with status Unpaid / Partially paid / Paid / Void and reconciliation to factoring remittance. | P0 | R2 |
| FR-CAR-025 | Reports (§12.4 list) and dashboard KPIs for accounting. | P1 | R2 |
| FR-CAR-026 | Fleet Companies (create, invite, review, approve, agreement, fees, escrow, settlement frequency, documents, banking, approve trucks/drivers, restrict, suspend, terminate); Fleet Management Agreement as its own object with statuses Draft, Pending Signature, Active, Suspended, Expired, Terminated. | P0 | R3 |
| FR-CAR-027 | Fleet settlement: gross revenue, management fee, insurance, fuel advance, escrow, maintenance deductions, other deductions, adjustments, net payable; the carrier approves and pays. | P0 | R3 |

## 7.3 Fleet Company Portal (R3)

| ID | Requirement | Pri |
|---|---|---|
| FR-FLT-001 | Dashboard: trucks owned/active/dispatched/available, drivers, loads, weekly/MTD/YTD earnings, pending/paid settlements, escrow balance, compliance and maintenance alerts. | P0 |
| FR-FLT-002 | Drivers: create → invite → maintain → assign → deactivate; documents; pay configuration; view loads and performance. Cannot make a driver carrier-approved or dispatch eligible. | P0 |
| FR-FLT-003 | Equipment: add truck/trailer, registration, insurance, inspection, maintenance, assign driver, odometer, internal availability, request removal. Carrier retains approval, eligibility and out-of-service authority. | P0 |
| FR-FLT-004 | Load visibility for its own equipment and drivers; cannot change broker/customer rates, assignments outside its fleet, carrier invoices or factoring. | P0 |
| FR-FLT-005 | Maintenance owned by the fleet company; carrier sees compliance-relevant information only. | P0 |
| FR-FLT-006 | Settlement: view, download, acknowledge, dispute carrier-generated settlements; cannot modify them. | P0 |
| FR-FLT-007 | Driver pay models: percentage of load, per mile, per load, flat weekly, salary, custom; the carrier does not control how the fleet divides its net settlement unless the agreement says so. | P0 |
| FR-FLT-008 | Escrow ledger view (opening balance, contributions, deductions, claims, adjustments, refunds, closing balance); dispute but not edit. | P0 |
| FR-FLT-009 | Users and settings for fleet staff. | P1 |

## 7.4 Platform Admin (minimal in R1, full in R4)

| ID | Requirement | Pri | Rel |
|---|---|---|---|
| FR-ADM-001 | Create and verify carrier tenants, configure subscription, activate/restrict/suspend/terminate; statuses Draft, Pending, Under Review, Approved, Active, Restricted, Suspended, Closed. | P0 | R1 (minimal) |
| FR-ADM-002 | Platform user management with MFA. | P0 | R1 |
| FR-ADM-003 | Cross-tenant visibility for support, risk and investigation; sensitive actions need elevated permission and a reason code; platform does not perform carrier dispatch (BR-008). | P0 | R1 |
| FR-ADM-004 | Platform financial monitoring: payment activity, failed/returned payments, platform fees, subscription revenue, exceptions. Carrier accounting stays with the carrier. | P1 | R4 |
| FR-ADM-005 | Case management: sources (driver, fleet, carrier, system), categories (payment, settlement, load, account, compliance, document, technical, dispute, other), workflow New → Assigned → In Progress → Waiting on User → Resolved → Closed. | P1 | R4 |
| FR-ADM-006 | Global configuration: document types, notification templates, platform roles, feature flags, standard statuses, default expiry rules, payment methods, integrations, platform fees, security settings; carrier overrides only where permitted. | P1 | R4 |
| FR-ADM-007 | Audit viewer across all audit events. | P0 | R1 |

## 7.5 Cross-cutting

| ID | Requirement | Pri |
|---|---|---|
| FR-X-001 | **Statuses** are standardized (§8) and defined once, shared by all apps. | P0 |
| FR-X-002 | **Notifications**: a single engine for in-app, push, email and SMS by event and user preference (§9). | P0 |
| FR-X-003 | **Permissions**: role + permission + tenant + relationship + resource ownership evaluated on every request (§10). | P0 |
| FR-X-004 | **Audit** events for BR-012 actions with actor, time, before/after and reason. | P0 |
| FR-X-005 | Sensitive fields (bank details, SSN, ID images) masked by default, encrypted at rest, access logged. | P0 |
| FR-X-006 | File names sanitized; special characters never break downloads (known v1 defect). | P0 |
| FR-X-007 | Lists refresh after every save (known v1 defect). | P1 |
| FR-DS-01 | All applications use the I-way brand tokens and component rules; the Make prototype's dark amber theme is replaced. Status chips always pair colour with a word. | P0 |

# 8. Status architecture

| Object | Statuses |
|---|---|
| Driver | Invited → Onboarding → Under Review → Approved → Active → Restricted → Suspended → Inactive → Terminated |
| Equipment | Pending → Under Review → Approved → Available → Assigned → Maintenance → Out of Service → Inactive |
| Fleet Company | Invited → Onboarding → Under Review → Approved → Active → Restricted → Suspended → Terminated |
| Carrier | Pending → Under Review → Approved → Active → Restricted → Suspended → Closed |
| Load | Draft → Unassigned → Assigned → Accepted → En Route to Pickup → At Pickup → Loaded → In Transit → At Delivery → Delivered → POD Submitted → Completed → Settled → Closed |
| Settlement | Draft → Calculated → Under Review → Approved → Payment Pending → Processing → Paid → Failed/Returned → Closed |
| Document | Required → Submitted → Under Review → Approved → Expiring Soon → Expired / Rejected |
| Invoice | Draft → Approved → Sent → Partially Paid → Paid; Void |

Driver-visible load status is the subset Assigned through POD Submitted; the carrier controls later financial statuses.

# 9. Notifications

Channels: in-app, push, email, SMS, by event and preference. Key chains:

- Driver uploads a replacement CDL → Carrier compliance notified → reviewed → approved → driver notified → fleet company notified.
- Carrier generates fleet settlement → fleet notified → acknowledge or dispute → carrier resolves → payment → fleet notified.
- Load picked up / delivered → broker email (FR-CAR-008); BOL/POD documents → broker email.
- Document expiry reminders at configurable intervals; service-due warnings; new assignment; settlement posted.

# 10. Permission architecture

Authorization evaluates **role + permission + tenant + relationship + resource ownership** (diagram 05). A Fleet Administrator holding `driver:view` still needs the driver to belong to that fleet company; a Carrier A user requesting Load 5678 needs the load to belong to Carrier A. Platform staff cross-tenant access requires elevated permission and a reason code and is always audited.

# 11. Core domain model

Platform → Carrier (tenant) → {Carrier users, drivers, equipment, customers, brokers, loads (stops, driver, equipment, documents, events, expenses, tracking), invoices, settlements (driver, fleet), escrow, compliance, accounting} and → Fleet Management Agreements → Fleet Company → {users, drivers, equipment, maintenance, driver pay}. Platform administration holds users, configuration, billing, cases, integrations, audit.

Additional entities from the rebuild documentation: Broker, Facility (shipper/receiver), FactoringCompany, FactoringSchedule, TrackingLink (token, load, recipient, expiry, views), StopEvent (arrived, departed, BOL, POD with geolocation and signature evidence), VehicleDocument / DriverDocument / OwnerDocument, AuditLog, Dispatcher, ServiceRecord.

# 12. Rules, formulas and data handling

## 12.1 Onboarding gates
Each onboarded type (driver, vehicle, truck owner, broker, customer, factoring company) follows the same five gates: started, details captured, documents, verification, approval; active only when every blocking item is valid. Required documents and checks per type are listed in the rebuild documentation (e.g. driver: CDL, DOT medical card, application, W-4 or W-9, direct-deposit form; vehicle: registration or cab card, annual DOT inspection, insurance, Form 2290, lease, permits).

## 12.2 Pay-period rules
Pay weeks run Monday to Sunday per carrier. A load belongs to the week containing its first pickup in the carrier's time zone. Late loads count toward a closed week until a per-carrier cut-off; "Wednesday of the following week" is the proposed default. [TBC OQ-04]

## 12.3 Sensitive data
SSN, ID images, bank details and tax forms: collected only where required (dispatcher and driver onboarding), encrypted, masked in UI, role-restricted, access-logged, never shown in public pages, notifications, URLs or analytics. Retention and legal review are open items. [TBC OQ-08]

## 12.4 Settlement calculation
Per payee per week: **net pay = share % × Σ load revenue − admin fee % × revenue − fixed deductions − escrow instalment ± adjustments**. Shares and deductions come from the vehicle's financial settings; each deduction line carries separate driver and owner amounts; each deduction applies once per week; the column label is "Gross Revenue". Settlements by ownership: company-owned → driver settlement (company keeps owner share); third-party/owner-operator → separate driver and owner settlements; driver-owned → one or two settlements [TBC OQ-02]. Escrow shows "paid X of target"; a payee with no escrow is valid. Fleet settlement example from the master document (illustrative): gross 18,000; management fee −1,800; fuel −3,200; insurance −400; escrow −300; other −150; net payable 12,150.

Required reports: driver earnings, drivers summary, gross revenue (by truck/driver/broker/period), net payable, expenses by category, invoice log / AR aging, dashboard KPIs.

# 13. Public website requirements (R0)

Governed by the directive. **Rule: show the customer-facing outcome, not the proprietary mechanism.**

## 13.1 Information boundary
The public site and its source files must not reveal: strategy or market-entry plans; proprietary algorithms, routing, pricing or matching logic; AI mechanisms, prompts or orchestration; architecture, schemas or infrastructure; internal workflows, approval logic or automation rules; financial models or margins; roadmap or unannounced features; security implementation. Internal documentation lives outside `site/public` and is never deployed with it.

## 13.2 Structure (implemented in site/public)

| Section | Requirement |
|---|---|
| Navigation | Sticky; Logo, Solutions, How It Works, Industries, FAQ, Sign In, Get Started; mobile menu. |
| Hero | "Move Smarter. Go Further." Subheadline per directive; primary CTA Get Started; secondary Explore I-way; original graphic of delivery, dashboard and tracking indicators. |
| Customer benefits | Ship with confidence; Stay informed at every step; Spend less time coordinating; Keep deliveries organized. |
| How it works | 01 Tell us what you're moving; 02 Plan your delivery; 03 Stay connected. |
| Product experience | Application mockup: shipment overview, delivery status, tracking map, upcoming deliveries, notifications, primary action; sample data labelled illustrative. |
| Industries | Retail, e-commerce, manufacturing, distribution, growing businesses. |
| Trust | Privacy, transparency, reliability, support; no fabricated certifications, logos, testimonials, statistics or security guarantees. |
| FAQ | The eight directive questions, answered only from verified capabilities and approved commercial information; pricing marked unpublished until approved. |
| Final CTA | "Ready to move smarter?" / "A simpler logistics experience starts here." / Get Started. |
| Footer | Logo and tagline, solutions, how it works, industries, FAQ, contact, Privacy Policy, Terms of Service, copyright; social links only where approved. |

Supporting pages: early access, sign in, contact, privacy and terms (draft placeholders until counsel approves).

## 13.3 Conversion journey
Visitor → understand value → build trust → Get Started → early access → (when accounts open) create account → onboarding.

- One clear primary CTA per section; minimal required fields (name, email); no popups; no forced account creation.
- Loading, validation and error states; inputs persist through recoverable errors (session storage); focus management on success.
- Honest early-access mode while registration is closed. The shipped build runs in **preview mode** and says plainly that nothing is stored until a sign-up service is connected. No misleading scarcity or fabricated social proof.
- Sign In is a chooser (Driver, Carrier, Fleet company). Credentials are entered only inside each application. An option is disabled with an honest message until its URL is configured. Platform Admin is never listed publicly.
- Future account creation and onboarding (R1+): password visibility toggle, recovery, keyboard and mobile support, progress indicator, no dead ends. The existing application login screens already include a password visibility toggle and a forgot-password link; account recovery behaviour must be implemented and tested server-side.

## 13.4 Events, accessibility and performance
See docs/CONVERSION_EVENTS.md and docs/ACCESSIBILITY_PERFORMANCE_CHECKLIST.md. Key points: no cookies, no PII in events; WCAG 2.2 AA target; white text on brand orange fails contrast (2.9:1), so orange buttons carry Navy text (5.3:1); reduced-motion respected.

# 14. Acceptance criteria

## 14.1 Public website (from the directive)
- A new visitor understands the customer value within seconds.
- The primary conversion action is immediately visible.
- Navigation is intuitive; every CTA has a meaningful destination; no dead ends.
- The product looks like a credible logistics application.
- Responsive and accessible; official I-way brand assets used unaltered.
- No proprietary strategy or implementation detail disclosed; no unsupported claims.
- `npm run verify` passes (build, IP scan, link and accessibility static checks) and a human IP-disclosure review is signed.

## 14.2 Applications
- Ownership rules (§5) enforced by tests: a fleet company cannot approve its own driver; a driver cannot alter commercial terms; one carrier cannot read another's data.
- Settlement fixtures reproduce expected results, including no double-counted deductions and no adjustment on approved settlements.
- Every BR-012 action produces an audit event.

# 15. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Targets from the v1 known-issues list: pages under 2 seconds, saves under 1 second under expected load; budgets verified by load tests. Public site: LCP under 2.5 s on a mid-range mobile profile [TBC measurement]. |
| Availability | Monitoring, status alerts, backups and a defined uptime target [TBC OQ-09]; multi-region decision in ADR. |
| Security | MFA for staff, encrypted secrets and sensitive fields, least privilege, tenant isolation tests, dependency scanning, secrets manager (v1 kept secrets in config files). |
| Data | UTC storage; deactivate-not-delete; audit retention [TBC]. |
| Operations | Dev/staging/production in company-owned cloud accounts; CI/CD with automated tests; company-owned repositories, domain and app-store accounts. |
| Accessibility | WCAG 2.2 AA for public site and all apps; 44 px minimum targets, 52 px for the driver's main action. |
| Localization | Carrier time zone for all date logic; US units initially [TBC]. |

# 16. Epics

| Epic | Name | Rel |
|---|---|---|
| 01 | Identity, authentication and RBAC | R1 |
| 02 | Carrier onboarding and administration | R1 (minimal) / R4 |
| 03 | Fleet companies and management agreements | R3 |
| 04 | Driver onboarding and compliance | R1 |
| 05 | Equipment and maintenance | R1 |
| 06 | Customer and broker management | R1 |
| 07 | Load management | R1 |
| 08 | Dispatch and driver assignment | R1 |
| 09 | Driver load execution and tracking | R1 |
| 10 | Documents, BOL and POD | R1 |
| 11 | Settlements, earnings and escrow | R2 / R3 |
| 12 | Banking and payments | R2 |
| 13 | Notifications | R1 |
| 14 | Reporting and analytics | R2 |
| 15 | Platform administration, cases and audit | R1 (audit) / R4 |
| 16 | Public website and early access | R0 |
| 17 | v1 migration and cut-over | R2 |

For each epic the next artifact is a backlog of user stories per persona with acceptance criteria, API requirements, data entities, notifications and exception scenarios.

# 17. Migration from iWay Dispatch v1

Import the v1 database (schema image and backup were delivered in the handover), run old and new settlements side by side for two pay weeks before switching, rebuild mobile apps under company-owned store accounts, and keep the v1 history of known issues as regression tests. Handover items still open at the last record: domain transfer, app-store transfers, hosting shutdown and final export, secrets list, design files. [TBC]

# 18. Integrations to scope

Maps and geocoding (route miles, geofences), push/email/SMS, banking and payments, factoring submissions (email, portal or API), ELD/GPS feeds, fuel-card imports (Comdata appears in v1 deductions), QuickBooks export, BI. Vendors are not selected here.

# 19. Risks

| Risk | Mitigation |
|---|---|
| Scope expansion from two-app to four-app ecosystem | Phase by release; re-estimate before committing dates |
| Settlement errors repeat v1 failures | Fixtures, once-per-week deduction rule, preview, un-approve with audit |
| Cross-tenant data exposure | Tenant + relationship checks on every request; isolation tests |
| Public site leaks internal design | Separate folders, IP scan gate, human review |
| Sensitive data (SSN, banking) mishandled | §12.3 controls, legal review before collection |
| Unverified capability claims on public pages | Copy limited to verified capabilities; FAQ review before release |
| Prototype state mistaken for production | Prototype stays in reference/ and is labelled |

# 20. Open questions

| ID | Question | Owner |
|---|---|---|
| OQ-01 | Confirm R1 = driver–dispatcher only vs. the master four-app MVP. | Product |
| OQ-02 | Driver-owned vehicles: one settlement or two? | Finance / Product |
| OQ-03 | Are owners given a portal now or later (v1 phase 2)? | Product |
| OQ-04 | Pay-week cut-off default (proposed Wednesday of the following week). | Finance |
| OQ-05 | Invoice number prefix per carrier. | Finance |
| OQ-06 | Is in-app bank payment in scope, and for which release? | Product |
| OQ-07 | Public pricing and approved commercial copy for the FAQ. | Commercial |
| OQ-08 | Retention, encryption and legal basis for SSN/ID/bank data. | Legal / Security |
| OQ-09 | Uptime target and hosting region strategy. | Engineering |
| OQ-10 | Approved public contact email, social channels, privacy policy and terms. | Legal / Marketing |
| OQ-11 | Native vs. cross-platform driver app (ADR-002). | Engineering |
| OQ-12 | Target audience emphasis of the public site: shippers (per directive copy) vs. carriers and drivers (per product scope). Current build serves shippers on the page and routes carriers, fleets and drivers via Sign In. | Product / Marketing |

# Appendix A — Traceability

| Source | Where it lands |
|---|---|
| Directive §1 information boundary | §13.1, IP scan, docs/IP_DISCLOSURE_REVIEW.md |
| Directive §3 structure | §13.2, site/public/index.html |
| Directive §4 conversion | §13.3, early-access.html, site.js |
| Directive §5 brand | Brand tokens, styles.css |
| Directive §6 deliverables | See README "Deliverables map" |
| Master requirements §4–12 | §7.1 |
| Master requirements §13–26 | §7.2 |
| Master requirements §27–35 | §7.3 |
| Master requirements §36–42 | §7.4 |
| Master requirements §43–48 | §5, §8, §9, §10 |
| Make refinements (~100) | FR-DRV-007 to 018, FR-CAR-002 to 025 |
| Rebuild Documentation | BR-013 to BR-020, §12, §15, §17 |
