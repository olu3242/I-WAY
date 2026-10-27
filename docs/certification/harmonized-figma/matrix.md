# Harmonized screen and functionality matrix

Source: [Issue #20](https://github.com/olu3242/I-WAY/issues/20). Route and navigation are separate: client tabs are not fictional HTTP routes. Every mapped screen remains partial unless its complete acceptance criteria have evidence. Test paths identify regression scope, not PASS. Current executed subsets and preserved denials: [B751–B770 execution matrix](../b751-b770/screen-evidence.md).

| Persona / prototype screen | Current route · navigation | Required permissions | Working scope | Status / remaining gap |
|---|---|---|---|---|
| carrier:dashboard | /app · overview, analytics | load:view, analytics:view | Persisted visible loads and measured operations totals | partial: Prototype finance/compliance KPI layout and complete fleet breakdown are not implemented |
| carrier:load-manager | /app · loads, load-wizard | load:view, load:create, load:dispatch | Four-step creation, durable drafts, review, confirmation, safe retry, dispatch and execution | partial: Specialized equipment types need an approved contract; live map/provider absent |
| carrier:dispatchers | /app · people | user:manage | Tenant-scoped accounts and bounded permission delegation | partial: Dispatcher pay/reporting and sensitive onboarding policy remain incomplete |
| carrier:fleet-resources | /app · assets, maintenance | asset:view, asset:manage, driver:approve, vehicle:approve | Owned assets, employment and independent carrier eligibility holds | partial: Full truck detail, sensitive attachments and specialized equipment contract |
| carrier:directory | /app · directories, customers | customer:manage | Persisted typed broker/customer/factor/facility records and relationships | partial: Approved external book of record and delivery remain blocked |
| carrier:onboarding | /app · onboarding, people | user:manage, driver:approve | Typed local onboarding submissions, needs-information and activation gates | partial: No real identities or invitations; approved delivery and sensitive storage absent |
| carrier:compliance | /app · assets, documents, onboarding | driver:approve, vehicle:approve, document:review | Carrier holds, expiry eligibility, shipping-document review and onboarding status | partial: Complete identity/equipment document packages, reminders and storage policy |
| carrier:accounting | /app · settlements, billing, finance | settlement:manage, billing:manage, finance:manage | Integer-cent statements, invoice readiness, approved PDFs and receivable evidence | partial: Payment provider and approved delivery absent; approval never means transferred money |
| carrier:reports | /app · analytics, settlements | analytics:view, settlement:view | Measured operational summaries and governed statement PDFs | partial: Full accounting report catalog and exports incomplete |
| carrier:settings | /admin ·  | governance:manage | Existing company settings and deny-only configuration at /admin | partial: Separate /admin route retained; no silent permission expansion |
| fleet:dashboard | /app · overview | load:view | Own loads/assets/approved statements projected by server | partial: Complete period/payment/maintenance dashboard incomplete |
| fleet:drivers | /app · assets, people, onboarding | asset:view, employment:manage | Own employment and local profile lifecycle; carrier approval independent | partial: Hosted accounts and full sensitive document package blocked |
| fleet:equipment | /app · assets, maintenance | asset:manage, asset:service | Owned equipment edits/service history retain carrier holds | partial: Specialized trailer/type and removal policy incomplete |
| fleet:loads | /app · loads | load:view | Own assigned loads; commercial rates and foreign assignments withheld | partial: Original visual comparison blocked; live tracking not connected |
| fleet:maintenance | /app · maintenance | asset:service | Owner service review, odometer reports, explicit intervals and due warnings | partial: Automatic distance/location and vendor/cost scheduling absent |
| fleet:settlements | /app · settlements | settlement:view, settlement:dispute | Own approved carrier statements, immutable disputes and PDF downloads | partial: Acknowledgment/dispute resolution and actual payment are incomplete |
| fleet:driver-pay | /app · driver-pay | payroll:manage | Explicit six-model terms, approval/revision, source budget and expense allocation | partial: No invented employment terms or payment execution |
| fleet:escrow | /app · settlements | settlement:view | Read-only approved escrow contributions | partial: Full debit/refund/claim/opening/closing ledger requires approved contract |
| fleet:compliance | /app · assets, onboarding | asset:view | Own eligibility/approval states; fleet cannot clear carrier holds | partial: Full compliance document packages/reminder contract not complete |
| driver:loads | /app · loads | load:view, load:execute, pod:record | Own assignment acceptance/rejection, ordered stops, pickup/transit/delivery and bounded acknowledgments | partial: Arrival/geofence/maps and signed-image storage need approved contracts |
| driver:truck | /app · assets, maintenance | asset:view, asset:service | Assigned equipment and durable service reports | partial: Registration/insurance/lease storage and live odometer integration absent |
| driver:documents | /app · loads, onboarding | document:view, document:manage | Authorized reviewed shipping metadata/revisions, summaries and owned profile states | partial: No sensitive uploads, signature images or identity-document storage |
| driver:pay | /app · settlements, expenses | settlement:view, payroll:view | Own approved earnings, period summaries/PDFs and governed expenses | partial: Full payment evidence/provider and policy-dependent ledger cases blocked |
| driver:chat | No approved route ·  |  | No real dispatcher chat or call adapter | design-only: Approved contact model, consent, delivery provider and authorization contract required |
| driver:profile | /app · onboarding, notifications | notification:preferences | Owned onboarding profile and persisted notification preferences | partial: PIN/biometrics/trusted-device contract and sensitive banking/storage absent |
| platform:dashboard | No approved route ·  |  | Governance-only workspace retained | obsolete-in-design: Prototype cross-tenant operational metrics cannot be reintroduced without scoped authority |
| platform:carriers | No approved route ·  | platform:invite | Canonical invitation contract and local management fixtures exist | partial: Carrier lifecycle and subscription management surface incomplete |
| platform:fleet-cos | No approved route ·  |  | No operational tenant reader granted | obsolete-in-design: Owner-approved scoped management reader, independent approval/reason/expiry required |
| platform:drivers | No approved route ·  |  | No global driver PII reader granted | obsolete-in-design: Owner-approved management scope and privacy policy required |
| platform:loads | No approved route ·  |  | Platform operational access explicitly denied | obsolete-in-design: Prototype global loads/impersonation must not bypass tenant isolation |
| platform:payments | No approved route ·  |  | No platform payment execution or monitoring claimed | design-only: Approved isolated billing/provider contract absent |
| platform:cases | /uat/control · #platform-workspace | platform:cases | Persisted cases with owner, transitions, reasons, versions and replay-safe commands | partial: Hosted governance identities and real external support delivery blocked |
| platform:compliance | No approved route ·  |  | Operational compliance remains with carrier owner | obsolete-in-design: Global compliance view requires explicitly scoped management contract |
| platform:config | /uat/control · #platform-config | platform:configure | Governed case-response configuration with reason/audit | partial: Global override/delegation catalog absent |
| platform:audit | /uat/control · #audit-action | platform:audit | Governance audit read and isolated activity viewer | partial: Cross-tenant operational audit needs explicit scoped grant |

All root Screen/Tab identifiers and known inert footer navigation mapped; nested panels, dialogs, permutations and all PRD clauses still require separate acceptance review. This is not complete screen/state conformity.

## Design decisions

- H01: Keep current permission-filtered workspace tabs and all newer capabilities; do not replace server-backed workflows with static prototype cards
- H02: Retain canonical i-way-logo.svg asset filenames; brand display text is independent of filesystem paths; logo bytes remain unmodified by this work
- H03: Integrated PR #19 (893f7f56d39d3e1a46c8bddadb71265216b30ae1), including PR #18 (a2090b9d8ad70329eb2412a1af4befbac241b918), preserves server-verified owner-profile selection, current memberships, AAL2, rotated cookie/CSRF and owner-attributed audit. No real profile grants were created. Prototype app selection never grants authority
- H04: Existing platform governance is not a global operational portal; obsolete prototype tenant readers remain denied
- H05: Original Figma URL/version/exports are absent; captures compare current responsive/token behavior only. No visual or functional conformity percentage is certified
