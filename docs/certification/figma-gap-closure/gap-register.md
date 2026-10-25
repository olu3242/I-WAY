# Figma/PRD requirement review

Every FR row is included. PARTIAL and MISSING are implementation gaps, not external blockers. BLOCKED_DECISION applies only to the specified unresolved sensitive/native contract. Local test results do not certify hosted authentication.

| Requirement | Priority | Status | Verified implementation scope | Remaining gap / next action |
|---|---|---|---|---|
| FR-DRV-001 | P0 | PARTIAL | Synthetic Google/password/session lifecycle and preferences | Native PIN, biometrics and trusted-device contract (ADR-002); real provider/MFA activation A07-A09 |
| FR-DRV-002 | P0 | PARTIAL | Invitation acceptance and canonical identity mapping under synthetic providers | Complete onboarding/profile and sensitive document storage (OQ-08); approved delivery and real identities |
| FR-DRV-003 | P0 | PARTIAL | Active/compliance/approval gates and invitation lifecycle | Full onboarding status progression and needs-information review UI |
| FR-DRV-004 | P0 | PARTIAL | Scoped current assignments, compliance and approved earnings views | ETA, distance, messages and complete dashboard summaries; approved map/tracking provider |
| FR-DRV-005 | P0 | IMPLEMENTED_LOCAL | Assigned load view, accept, reject with reason, release and replay-safe audited receipt | Hosted identity certification remains separate |
| FR-DRV-006 | P0 | PARTIAL | Ordered multi-stop pickup, transit, delivery and acknowledgment | Arrival/loading/unloading milestones and navigation integration |
| FR-DRV-007 | P0 | MISSING | No implemented geofence arrival workflow | Approved location/native contract plus manual-arrival UI and event transitions |
| FR-DRV-008 | P0 | MISSING | No live map or truck position claimed | Approved map/tracking provider, location consent and native/background decision |
| FR-DRV-009 | P0 | PARTIAL | Authorized immutable text/JSON shipping-document revisions | Rate-confirmation PDF storage and renderer |
| FR-DRV-010 | P0 | BLOCKED_DECISION | Bounded recipient acknowledgment references only | Signed BOL/POD image storage, retention and signature evidence review (OQ-08/ADR-002); approved broker delivery |
| FR-DRV-011 | P0 | PARTIAL | Audited bounded text exceptions and human recovery workflow | Photo/attachment/location capture and remaining categories; reviewed storage and consent |
| FR-DRV-012 | P0 | PARTIAL | Shipping-document ingestion/revisions and independent human review | Driver identity-document upload/renewal and sensitive storage OQ-08 |
| FR-DRV-013 | P0 | PARTIAL | Expiry/compliance gates deny dispatch | Complete compliance states, document types and configurable reminder windows |
| FR-DRV-014 | P1 | MISSING | No chat or call workflow claimed | Dispatcher contact consent, contact model and approved communications adapter |
| FR-DRV-015 | P1 | PARTIAL | Assigned equipment and service information | Truck-document access, registration/insurance/lease storage contract |
| FR-DRV-016 | P1 | IMPLEMENTED_LOCAL | Assigned driver service reports persist into equipment-owner history | Hosted synchronization remains untested |
| FR-DRV-017 | P1 | PARTIAL | Explicit carrier service interval, odometer reports and due warnings | Automatic load-distance/geolocation odometer integration; ADR-002 and approved provider |
| FR-DRV-018 | P1 | PARTIAL | Notification preferences and local authentication workflows | Direct-deposit storage OQ-08; complete profile, password-change and support screens |
| FR-DRV-019 | P0 | PARTIAL | Only own approved carrier settlement or fleet driver pay; commercial source fields withheld | Period summaries, reimbursements, statement/report PDFs and full history filters |
| FR-DRV-020 | P1 | MISSING | No driver expense submission claimed | Owned expense submission/review contract, UI, evidence storage and reimbursement linkage |
| FR-DRV-021 | P0 | PARTIAL | IndexedDB bounded status queue, static recovery shell, reload/reconnect and exactly-once server replay | Native delivery ADR-002; secure photos/signatures offline storage and device review |
| FR-CAR-001 | P0 | PARTIAL | Tenant-scoped operational totals and analytics | Full finance/resource/compliance KPI set and fleet breakdown |
| FR-CAR-002 | P0 | PARTIAL | Validated load creation with rates, ordered stops and dispatcher ownership | Four-step wizard, inline broker/customer/facility creation, windows, private notes and dimensions |
| FR-CAR-003 | P0 | PARTIAL | Search plus active/completed lists with carrier-time-zone presentation | Request-date range filters and complete reference list columns |
| FR-CAR-004 | P0 | PARTIAL | Owned load detail, human tracking, assignment and reviewed shipping metadata | Live location/distance, PDF attachments and approved broker tracking-link delivery |
| FR-CAR-005 | P0 | IMPLEMENTED_LOCAL | Eligible assignment/reassignment, one active assignment, audited cancellation | Hosted four-persona certification remains blocked |
| FR-CAR-006 | P0 | PARTIAL | Scoped resource/capacity overview and human dispatch | Live map, truck positions and route lines; approved tracking provider |
| FR-CAR-007 | P0 | PARTIAL | Audited void and pre-pickup assignment changes | Full status-aware correction/TONU contract protecting approved financial sources |
| FR-CAR-008 | P0 | PARTIAL | Local lifecycle notification outbox and broker connector mocks | Owner-approved broker book of record, delivery provider/sender and real delivery certification |
| FR-CAR-009 | P0 | PARTIAL | Protected invitation/session workflow and company configuration | Complete typed onboarding hub for all resource classes and document approval gates |
| FR-CAR-010 | P1 | PARTIAL | Company directory configuration scaffolding | Verified typed broker/factor address forms and relationship workflows |
| FR-CAR-011 | P0 | PARTIAL | Role-scoped drivers/equipment, ownership, edits and approvals | Asset subnavigation and full typed truck detail |
| FR-CAR-012 | P0 | PARTIAL | Vehicle ownership, capacity and approval gates | Vehicle-type wizard, financial settings and sensitive document package |
| FR-CAR-013 | P0 | PARTIAL | Scoped equipment maintenance edits and separate service-plan form | Section-specific truck/driver assignment, financial terms and deduction editor |
| FR-CAR-014 | P1 | PARTIAL | Carrier intervals, warnings and driver/owner service history | Automatic load-distance/location integration required by linked FR-DRV-017 |
| FR-CAR-015 | P0 | PARTIAL | Driver availability/compliance edits and approved pay projection | Full profile/employment/documents, vehicle pay terms, escrow history and PDFs |
| FR-CAR-016 | P0 | PARTIAL | Invitation lifecycle and dispatch eligibility gates | Complete admin/invite onboarding progress UI |
| FR-CAR-017 | P1 | PARTIAL | Dispatcher account management and scoped permissions | Dispatcher payment models/reports and sensitive onboarding policy OQ-08 |
| FR-CAR-018 | P0 | PARTIAL | Carrier approvals, expiry gates and out-of-service hold enforcement | All driver/equipment/fleet document classes, complete review/reminder states |
| FR-CAR-019 | P0 | PARTIAL | Customer relationships and bounded administrative configuration | Typed broker/factor/facility/rate/terms/history modules |
| FR-CAR-020 | P0 | PARTIAL | Carrier account/permission governance with tenant-scoped denies | Accounting role and complete approved role catalog/delegation UI |
| FR-CAR-021 | P0 | PARTIAL | Weekly draft/recalculate/adjust/approve/unapprove, immutable evidence and fleet disputes | Week navigation, moves, search and approved statement PDFs; cutoff policy OQ-04 |
| FR-CAR-022 | P0 | PARTIAL | Integer-cent fixture calculation, weekly uniqueness, source-version checks and escrow cap | Vehicle-sourced approved terms, full pay models and v1 parallel reconciliation data |
| FR-CAR-023 | P0 | PARTIAL | Document-reviewed invoice generation, issue and receivable lifecycle | Three-PDF packet, invoice-format OQ-05, downloads and approved broker/factor delivery |
| FR-CAR-024 | P0 | PARTIAL | Reported payment evidence, independent review and reconciliation fixtures | Actual provider/remittance integration and owner-approved payment scope OQ-06 |
| FR-CAR-025 | P1 | PARTIAL | Measured operational analytics | Complete accounting report list, period summaries and exports |
| FR-CAR-026 | P0 | PARTIAL | Fleet ownership, employment, equipment and carrier eligibility controls | Fleet Management Agreement lifecycle, all financial/document/banking controls |
| FR-CAR-027 | P0 | PARTIAL | Fleet revenue/fees/deductions/escrow/adjustment/net approval | Actual payment execution and complete agreement-bound financial terms |
| FR-FLT-001 | P0 | PARTIAL | Own assets, assignments, settlements and driver-pay views | Full period earnings/payment/maintenance dashboard |
| FR-FLT-002 | P0 | PARTIAL | Own driver employment, account activation fixtures and carrier approval boundary | Complete invite/document/pay configuration and performance views; hosted identities A08-A09 |
| FR-FLT-003 | P0 | PARTIAL | Own vehicle creation/editing and maintenance reports preserve carrier holds | Trailer/type, document and removal-request workflows |
| FR-FLT-004 | P0 | IMPLEMENTED_LOCAL | Own driver/equipment loads only; commercial rates and foreign assignments withheld | Hosted certification remains blocked |
| FR-FLT-005 | P0 | PARTIAL | Fleet-owned service review; carrier receives compliance-relevant projection | Complete maintenance scheduling/vendor/cost workflows |
| FR-FLT-006 | P0 | PARTIAL | Own carrier settlement view and immutable dispute sidecar | Acknowledgment, approved PDF and dispute resolution workflow |
| FR-FLT-007 | P0 | PARTIAL | Explicit per-load draft and approval with current employment and settlement budget checks | Percentage, mileage, flat-week, salary and custom terms with approved calculation bases |
| FR-FLT-008 | P0 | PARTIAL | Read-only system-calculated approved contributions | Full opening/debit/claim/refund/closing escrow ledger and dispute resolution |
| FR-FLT-009 | P1 | PARTIAL | Own driver employment and preferences | Fleet staff roles, invitations and company settings contract |
| FR-ADM-001 | P0 | PARTIAL | Protected governance namespace and tenant-bound synthetic fixtures | Carrier-tenant lifecycle, subscriptions and approved management-plane authority |
| FR-ADM-002 | P0 | PARTIAL | Canonical privileged invitation/MFA fixtures and session gates | Real AAL2 evidence, staff account management and approved identity provisioning |
| FR-ADM-003 | P0 | MISSING | Platform operational tenant access is denied | Explicit scoped support grant/reason/expiry contract and management-plane read API; no authorization bypass |
| FR-ADM-004 | P1 | MISSING | No platform finance monitoring claimed | Approved billing/payment providers and isolated aggregate monitoring contracts |
| FR-ADM-005 | P1 | MISSING | No platform case-management application claimed | Case schema, owner role permissions and end-to-end case workflow |
| FR-ADM-006 | P1 | PARTIAL | Carrier configuration is isolated from platform governance | Platform global configuration with approved override/delegation catalog |
| FR-ADM-007 | P0 | PARTIAL | Protected platform governance audit viewer | Scoped cross-tenant audit access with reason-bound grants and sensitive-data policy |
| FR-X-001 | P0 | PARTIAL | Shared lifecycle compatibility projection | Complete PRD status/substatus mapping and all unimplemented resource lifecycles |
| FR-X-002 | P0 | PARTIAL | In-app records, preferences, durable outbox and mocked adapters | Approved email/push/SMS providers, sender/owner and actual delivery certification |
| FR-X-003 | P0 | IMPLEMENTED_LOCAL | Role, permission, tenant, relationship and ownership gates; restricted PostgreSQL FORCE RLS tested locally | Hosted target, authenticated restricted login and roster certification remain blocked |
| FR-X-004 | P0 | PARTIAL | Audited local consequential actions and append-only evidence | Full BR-012 coverage cannot be certified for unimplemented actions |
| FR-X-005 | P0 | BLOCKED_DECISION | Sensitive collection is not enabled | Owner-approved encryption, access logging, retention/deletion and legal/security policy OQ-08 |
| FR-X-006 | P0 | PARTIAL | Bounded document references and immutable text content | PDF/upload/download pipeline with hostile filename tests |
| FR-X-007 | P1 | IMPLEMENTED_LOCAL | Implemented views refresh from persisted API state after saves | No claim for absent screens |
| FR-DS-01 | P0 | PARTIAL | Unmodified logo, local Inter, token colors, card/button radii, driver targets and textual status chips tested | Original Figma exports/version BLOCKED_REFERENCE; complete typography/icon/spacing review and human accessibility remain outstanding |
