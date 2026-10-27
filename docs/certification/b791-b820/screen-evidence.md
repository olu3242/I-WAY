# B791–B820 screen and functionality evidence

All 35 prototype roots are accounted for. Current implementation captures cover 27 mappings at 390/768/1440 pixels (81 PNGs); eight mappings have no approved route. A capture proves current presentation, not complete prototype functionality. Original approved Figma exports/version are unavailable; both conformity percentages remain unmeasured. The Brand Kit supersedes legacy prototype styling. Exact current gaps and capture bindings are retained in [screen-evidence.json](screen-evidence.json).

| Screen | Current route / tabs | Whole-screen status and gap |
|---|---|---|
| carrier:dashboard | /app · overview, analytics | partial — Prototype finance/compliance KPI layout and complete fleet breakdown are not implemented |
| carrier:load-manager | /app · loads, load-wizard | partial — Specialized equipment types need an approved contract; live map/provider absent |
| carrier:dispatchers | /app · people | partial — Dispatcher pay/reporting and sensitive onboarding policy remain incomplete |
| carrier:fleet-resources | /app · assets, maintenance | partial — Full truck detail, sensitive attachments and specialized equipment contract |
| carrier:directory | /app · directories, customers | partial — Approved external book of record and delivery remain blocked |
| carrier:onboarding | /app · onboarding, people | partial — No real identities or invitations; approved delivery and sensitive storage absent |
| carrier:compliance | /app · assets, documents, onboarding | partial — Complete identity/equipment document packages, reminders and storage policy |
| carrier:accounting | /app · settlements, billing, finance | partial — Payment provider and approved delivery absent; approval never means transferred money |
| carrier:reports | /app · analytics, settlements | partial — Full accounting report catalog and exports incomplete |
| carrier:settings | /admin ·  | partial — Separate /admin route retained; no silent permission expansion |
| fleet:dashboard | /app · overview | partial — Complete period/payment/maintenance dashboard incomplete |
| fleet:drivers | /app · assets, people, onboarding | partial — Hosted accounts and full sensitive document package blocked |
| fleet:equipment | /app · assets, maintenance | partial — Specialized trailer/type and removal policy incomplete |
| fleet:loads | /app · loads | partial — Original visual comparison blocked; live tracking not connected |
| fleet:maintenance | /app · maintenance | partial — Automatic distance/location and vendor/cost scheduling absent |
| fleet:settlements | /app · settlements | partial — Acknowledgment/dispute resolution and actual payment are incomplete |
| fleet:driver-pay | /app · driver-pay | partial — No invented employment terms or payment execution |
| fleet:escrow | /app · settlements | partial — Full debit/refund/claim/opening/closing ledger requires approved contract |
| fleet:compliance | /app · assets, onboarding | partial — Full compliance document packages/reminder contract not complete |
| driver:loads | /app · loads | partial — Arrival/geofence/maps and signed-image storage need approved contracts |
| driver:truck | /app · assets, maintenance | partial — Registration/insurance/lease storage and live odometer integration absent |
| driver:documents | /app · loads, onboarding | partial — No sensitive uploads, signature images or identity-document storage |
| driver:pay | /app · settlements, expenses | partial — Full payment evidence/provider and policy-dependent ledger cases blocked |
| driver:chat | No approved route ·  | design-only — Approved contact model, consent, delivery provider and authorization contract required |
| driver:profile | /app · onboarding, notifications | partial — PIN/biometrics/trusted-device contract and sensitive banking/storage absent |
| platform:dashboard | No approved route ·  | obsolete-in-design — Prototype cross-tenant operational metrics cannot be reintroduced without scoped authority |
| platform:carriers | No approved route ·  | partial — Carrier lifecycle and subscription management surface incomplete |
| platform:fleet-cos | No approved route ·  | obsolete-in-design — Owner-approved scoped management reader, independent approval/reason/expiry required |
| platform:drivers | No approved route ·  | obsolete-in-design — Owner-approved management scope and privacy policy required |
| platform:loads | No approved route ·  | obsolete-in-design — Prototype global loads/impersonation must not bypass tenant isolation |
| platform:payments | No approved route ·  | design-only — Approved isolated billing/provider contract absent |
| platform:cases | /uat/control · #platform-workspace | partial — Hosted governance identities and real external support delivery blocked |
| platform:compliance | No approved route ·  | obsolete-in-design — Global compliance view requires explicitly scoped management contract |
| platform:config | /uat/control · #platform-config | partial — Global override/delegation catalog absent |
| platform:audit | /uat/control · #audit-action | partial — Cross-tenant operational audit needs explicit scoped grant |
