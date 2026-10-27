# B751–B770 screen/functionality execution matrix

The [source matrix](../harmonized-figma/matrix.md) covers all 35 root prototype screens. The [execution bindings](screen-evidence.json) link the current local scope to source-bound tests. A source-file link or matching title alone does not prove a full prototype screen. Whole-screen partial/obsolete/design-only statuses remain intact. Original approved images/version remain BLOCKED_REFERENCE.

| Screen | Current route / navigation | Executed local scope | Remaining gap |
|---|---|---|---|
| carrier:dashboard | /app · overview, analytics | PASS_REVIEWED_SCOPE: Persisted visible loads and measured operations totals | Prototype finance/compliance KPI layout and complete fleet breakdown are not implemented |
| carrier:load-manager | /app · loads, load-wizard | PASS_REVIEWED_SCOPE: Four-step creation, durable drafts, review, confirmation, safe retry, dispatch and execution | Specialized equipment types need an approved contract; live map/provider absent |
| carrier:dispatchers | /app · people | PASS_REVIEWED_SCOPE: Tenant-scoped accounts and bounded permission delegation | Dispatcher pay/reporting and sensitive onboarding policy remain incomplete |
| carrier:fleet-resources | /app · assets, maintenance | PASS_REVIEWED_SCOPE: Owned assets, employment and independent carrier eligibility holds | Full truck detail, sensitive attachments and specialized equipment contract |
| carrier:directory | /app · directories, customers | PASS_REVIEWED_SCOPE: Persisted typed broker/customer/factor/facility records and relationships | Approved external book of record and delivery remain blocked |
| carrier:onboarding | /app · onboarding, people | PASS_REVIEWED_SCOPE: Typed local onboarding submissions, needs-information and activation gates | No real identities or invitations; approved delivery and sensitive storage absent |
| carrier:compliance | /app · assets, documents, onboarding | PASS_REVIEWED_SCOPE: Carrier holds, expiry eligibility, shipping-document review and onboarding status | Complete identity/equipment document packages, reminders and storage policy |
| carrier:accounting | /app · settlements, billing, finance | PASS_REVIEWED_SCOPE: Integer-cent statements, invoice readiness, approved PDFs and receivable evidence | Payment provider and approved delivery absent; approval never means transferred money |
| carrier:reports | /app · analytics, settlements | PASS_REVIEWED_SCOPE: Measured operational summaries and governed statement PDFs | Full accounting report catalog and exports incomplete |
| carrier:settings | /admin ·  | PASS_REVIEWED_SCOPE: Existing company settings and deny-only configuration at /admin | Separate /admin route retained; no silent permission expansion |
| fleet:dashboard | /app · overview | PASS_REVIEWED_SCOPE: Own loads/assets/approved statements projected by server | Complete period/payment/maintenance dashboard incomplete |
| fleet:drivers | /app · assets, people, onboarding | PASS_REVIEWED_SCOPE: Own employment and local profile lifecycle; carrier approval independent | Hosted accounts and full sensitive document package blocked |
| fleet:equipment | /app · assets, maintenance | PASS_REVIEWED_SCOPE: Owned equipment edits/service history retain carrier holds | Specialized trailer/type and removal policy incomplete |
| fleet:loads | /app · loads | PASS_REVIEWED_SCOPE: Own assigned loads; commercial rates and foreign assignments withheld | Original visual comparison blocked; live tracking not connected |
| fleet:maintenance | /app · maintenance | PASS_REVIEWED_SCOPE: Owner service review, odometer reports, explicit intervals and due warnings | Automatic distance/location and vendor/cost scheduling absent |
| fleet:settlements | /app · settlements | PASS_REVIEWED_SCOPE: Own approved carrier statements, immutable disputes and PDF downloads | Acknowledgment/dispute resolution and actual payment are incomplete |
| fleet:driver-pay | /app · driver-pay | PASS_REVIEWED_SCOPE: Explicit six-model terms, approval/revision, source budget and expense allocation | No invented employment terms or payment execution |
| fleet:escrow | /app · settlements | PASS_REVIEWED_SCOPE: Read-only approved escrow contributions | Full debit/refund/claim/opening/closing ledger requires approved contract |
| fleet:compliance | /app · assets, onboarding | PASS_REVIEWED_SCOPE: Own eligibility/approval states; fleet cannot clear carrier holds | Full compliance document packages/reminder contract not complete |
| driver:loads | /app · loads | PASS_REVIEWED_SCOPE: Own assignment acceptance/rejection, ordered stops, pickup/transit/delivery and bounded acknowledgments | Arrival/geofence/maps and signed-image storage need approved contracts |
| driver:truck | /app · assets, maintenance | PASS_REVIEWED_SCOPE: Assigned equipment and durable service reports | Registration/insurance/lease storage and live odometer integration absent |
| driver:documents | /app · loads, onboarding | PASS_REVIEWED_SCOPE: Authorized reviewed shipping metadata/revisions, summaries and owned profile states | No sensitive uploads, signature images or identity-document storage |
| driver:pay | /app · settlements, expenses | PASS_REVIEWED_SCOPE: Own approved earnings, period summaries/PDFs and governed expenses | Full payment evidence/provider and policy-dependent ledger cases blocked |
| driver:chat | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: No real dispatcher chat or call adapter | Approved contact model, consent, delivery provider and authorization contract required |
| driver:profile | /app · onboarding, notifications | PASS_REVIEWED_SCOPE: Owned onboarding profile and persisted notification preferences | PIN/biometrics/trusted-device contract and sensitive banking/storage absent |
| platform:dashboard | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: Governance-only workspace retained | Prototype cross-tenant operational metrics cannot be reintroduced without scoped authority |
| platform:carriers | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: Canonical invitation contract and local management fixtures exist | Carrier lifecycle and subscription management surface incomplete |
| platform:fleet-cos | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: No operational tenant reader granted | Owner-approved scoped management reader, independent approval/reason/expiry required |
| platform:drivers | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: No global driver PII reader granted | Owner-approved management scope and privacy policy required |
| platform:loads | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: Platform operational access explicitly denied | Prototype global loads/impersonation must not bypass tenant isolation |
| platform:payments | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: No platform payment execution or monitoring claimed | Approved isolated billing/provider contract absent |
| platform:cases | /uat/control · #platform-workspace | PASS_REVIEWED_SCOPE: Persisted cases with owner, transitions, reasons, versions and replay-safe commands | Hosted governance identities and real external support delivery blocked |
| platform:compliance | No operational route ·  | BLOCKED_CONTRACT_OR_OBSOLETE: Operational compliance remains with carrier owner | Global compliance view requires explicitly scoped management contract |
| platform:config | /uat/control · #platform-config | PASS_REVIEWED_SCOPE: Governed case-response configuration with reason/audit | Global override/delegation catalog absent |
| platform:audit | /uat/control · #audit-action | PASS_REVIEWED_SCOPE: Governance audit read and isolated activity viewer | Cross-tenant operational audit needs explicit scoped grant |
