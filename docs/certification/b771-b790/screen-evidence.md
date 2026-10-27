# B771–B790 screen capture and functionality matrix

All 35 root screens are accounted for at 390/768/1440 pixels. The 81 images document current implementation surfaces for 27 screen mappings; several mappings share a route or tab. Eight mappings have no approved route. These captures are not original approved Figma images, and are not proof of whole-screen conformity. Full-screen statuses and gaps remain in the [source matrix](../harmonized-figma/matrix.md).

| Screen | Current surface | Capture widths | Full screen status / remaining gap |
|---|---|---|---|
| carrier:dashboard | /app · overview, analytics | 390, 768, 1440 | partial — Prototype finance/compliance KPI layout and complete fleet breakdown are not implemented |
| carrier:load-manager | /app · loads, load-wizard | 390, 768, 1440 | partial — Specialized equipment types need an approved contract; live map/provider absent |
| carrier:dispatchers | /app · people | 390, 768, 1440 | partial — Dispatcher pay/reporting and sensitive onboarding policy remain incomplete |
| carrier:fleet-resources | /app · assets, maintenance | 390, 768, 1440 | partial — Full truck detail, sensitive attachments and specialized equipment contract |
| carrier:directory | /app · directories, customers | 390, 768, 1440 | partial — Approved external book of record and delivery remain blocked |
| carrier:onboarding | /app · onboarding, people | 390, 768, 1440 | partial — No real identities or invitations; approved delivery and sensitive storage absent |
| carrier:compliance | /app · assets, documents, onboarding | 390, 768, 1440 | partial — Complete identity/equipment document packages, reminders and storage policy |
| carrier:accounting | /app · settlements, billing, finance | 390, 768, 1440 | partial — Payment provider and approved delivery absent; approval never means transferred money |
| carrier:reports | /app · analytics, settlements | 390, 768, 1440 | partial — Full accounting report catalog and exports incomplete |
| carrier:settings | /admin ·  | 390, 768, 1440 | partial — Separate /admin route retained; no silent permission expansion |
| fleet:dashboard | /app · overview | 390, 768, 1440 | partial — Complete period/payment/maintenance dashboard incomplete |
| fleet:drivers | /app · assets, people, onboarding | 390, 768, 1440 | partial — Hosted accounts and full sensitive document package blocked |
| fleet:equipment | /app · assets, maintenance | 390, 768, 1440 | partial — Specialized trailer/type and removal policy incomplete |
| fleet:loads | /app · loads | 390, 768, 1440 | partial — Original visual comparison blocked; live tracking not connected |
| fleet:maintenance | /app · maintenance | 390, 768, 1440 | partial — Automatic distance/location and vendor/cost scheduling absent |
| fleet:settlements | /app · settlements | 390, 768, 1440 | partial — Acknowledgment/dispute resolution and actual payment are incomplete |
| fleet:driver-pay | /app · driver-pay | 390, 768, 1440 | partial — No invented employment terms or payment execution |
| fleet:escrow | /app · settlements | 390, 768, 1440 | partial — Full debit/refund/claim/opening/closing ledger requires approved contract |
| fleet:compliance | /app · assets, onboarding | 390, 768, 1440 | partial — Full compliance document packages/reminder contract not complete |
| driver:loads | /app · loads | 390, 768, 1440 | partial — Arrival/geofence/maps and signed-image storage need approved contracts |
| driver:truck | /app · assets, maintenance | 390, 768, 1440 | partial — Registration/insurance/lease storage and live odometer integration absent |
| driver:documents | /app · loads, onboarding | 390, 768, 1440 | partial — No sensitive uploads, signature images or identity-document storage |
| driver:pay | /app · settlements, expenses | 390, 768, 1440 | partial — Full payment evidence/provider and policy-dependent ledger cases blocked |
| driver:chat | No approved route ·  | BLOCKED_CONTRACT | design-only — Approved contact model, consent, delivery provider and authorization contract required |
| driver:profile | /app · onboarding, notifications | 390, 768, 1440 | partial — PIN/biometrics/trusted-device contract and sensitive banking/storage absent |
| platform:dashboard | No approved route ·  | BLOCKED_CONTRACT | obsolete-in-design — Prototype cross-tenant operational metrics cannot be reintroduced without scoped authority |
| platform:carriers | No approved route ·  | BLOCKED_CONTRACT | partial — Carrier lifecycle and subscription management surface incomplete |
| platform:fleet-cos | No approved route ·  | BLOCKED_CONTRACT | obsolete-in-design — Owner-approved scoped management reader, independent approval/reason/expiry required |
| platform:drivers | No approved route ·  | BLOCKED_CONTRACT | obsolete-in-design — Owner-approved management scope and privacy policy required |
| platform:loads | No approved route ·  | BLOCKED_CONTRACT | obsolete-in-design — Prototype global loads/impersonation must not bypass tenant isolation |
| platform:payments | No approved route ·  | BLOCKED_CONTRACT | design-only — Approved isolated billing/provider contract absent |
| platform:cases | /uat/control · #platform-workspace | 390, 768, 1440 | partial — Hosted governance identities and real external support delivery blocked |
| platform:compliance | No approved route ·  | BLOCKED_CONTRACT | obsolete-in-design — Global compliance view requires explicitly scoped management contract |
| platform:config | /uat/control · #platform-config | 390, 768, 1440 | partial — Global override/delegation catalog absent |
| platform:audit | /uat/control · #audit-action | 390, 768, 1440 | partial — Cross-tenant operational audit needs explicit scoped grant |

Actual PNG paths, dimensions, SHA-256 and passing capture test titles are in [screen-evidence.json](screen-evidence.json). Original comparison for every row: BLOCKED_REFERENCE. Missing visual/functionality percentages are intentionally null.
