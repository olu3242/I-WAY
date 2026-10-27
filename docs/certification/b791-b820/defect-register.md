# B791–B820 defects and release dependencies

| ID | Severity | Status | Root cause / gap | Correction or exact next action |
|---|---|---|---|---|
| D01 | HIGH | FIXED | Pending governance response replaced adjacent edited fields; stale success remained visible | Serialize workspace writes, capture FormData before disabling controls, expose busy state, clear prior success, and confirm refreshed state before saved announcement |
| D02 | HIGH | FIXED | Durable request reconstruction rejected legitimate governance resource records | Allow only platformcase, platformcaseevent, platformconfig and supportrequest in governance; retain platform-only principals and deny operational/unknown kinds |
| D03 | MEDIUM | FIXED | Remote source/test edits left reconciliation and MVP inventory hashes stale | Regenerate both authoritative artifacts from current LF-normalized source; preserve discovery-versus-execution classifications |
| D04 | MEDIUM | FIXED | Platform keyboard test could begin during initial governance hydration | Wait for completed actual initial hydration and enabled control; require real audit POST 200 before retaining original audit assertion |
| D05 | MEDIUM | IMPLEMENTED_LOCAL_CI_BLOCKED | CI artifact upload omitted machine-readable browser/control summaries | Retain non-secret summary JSON alongside existing synthetic browser artifacts and include four configuration regressions in durable CI |
| G01 | CRITICAL | BLOCKED_OWNER_TARGET | No exclusive approved staging database/management owner; code pins explicitly excluded public early-access project | Owner designates target and private management owner/location, followed by one consistent reviewed pin/schema/credential integration |
| G02 | HIGH | BLOCKED_HOSTED_POLICY | SUPABASE_SERVICE_ROLE_KEY name configured in application Preview scope | Owner reviews removal from exact Preview scope and keeps management credential outside application; do not touch Production scope |
| G03 | HIGH | BLOCKED_IDENTITY_ACCESS | Approved four-email roster lacks verified target-specific canonical identity/role/tenant/fleet/employment evidence and controlled entry | Verify approved actual bindings and MFA; designate delivery owner/provider; approve each provisioning/access action separately |
| G04 | HIGH | BLOCKED_CONTRACT | Full Platform tenant provisioning/global readers and end-to-end platform-created onboarding are unsupported | Approve least-privilege management API, lifecycle, permissions and audit contracts; preserve carrier-owned dispatch |
| G05 | MEDIUM | BLOCKED_REFERENCE | Original approved Figma version and exports unavailable | Design owner provides canonical file/version and original screen exports while Brand Kit stays authoritative |
| G06 | MEDIUM | NOT_RUN_HUMAN | Human accessibility and real tester acceptance not performed | Execute preserved 48 human scripts and approved UAT acceptance after infrastructure/identity gates |
| G07 | MEDIUM | BLOCKED_CONTRACT | Sensitive upload/signature/GPS/provider contracts and seven named-agent aliases unresolved | Approve storage/access/retention/deletion and provider/alias-to-owner mappings before activation |
| G08 | HIGH | BLOCKED_PUSH_APPROVAL | Automatic approval review denied combined commit/push, citing standing no-push restriction | Owner explicitly approves pushing the exact local candidate SHA to existing feature branch/PR #21; then run and inspect authoritative CI before considering deployment |

Local tests do not substitute for blocked remote CI or hosted certification. Exact-target activation risks, prerequisites and rollback remain in [hosted-gate.md](hosted-gate.md).
