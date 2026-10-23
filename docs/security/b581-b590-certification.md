# I-WAY B581–B590 certification — 2026-10-23

Local synthetic candidate: GO for further isolated engineering validation. Hosted UAT: NO-GO. Production: NO-GO. No deployment, push, merge, provisioning, invitations, grants, billing, protection or production changes were performed.

Branch: `work/b561-b580-external-uat` in `.worktrees/b561-b580-external-uat`. Baseline: `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`. B581 reviewed candidate commit: `9a8b19afdabc13805bbbec9813812c0fc00a1f0a`. Final implementation commit is recorded in `b581-b590-receipt.json`; this report is committed separately so the receipt can identify its source without a circular commit hash.

| Batch | Result | Evidence / limitation |
| --- | --- | --- |
| B581 | PASS | Reviewed and committed original 18 files. Fixed failed issuance reactivation and orphan-session cleanup defects; added regression checks. No hosted SQL applied. |
| B582 | PASS local / BLOCKED hosted | Explicit parent/native session bridge; signed Supabase proof must match existing native binding. Secure HttpOnly cookies, native CSRF, refresh rotation, logout and revocation fencing. Local SQLite Operations persistence remains unsuitable for multi-instance Vercel hosting. |
| B583 | PASS synthetic / BLOCKED real | Password and Google resolve to one existing principal; identity binding count unchanged. Provider proof checks signature, issuer, audience, expiry, current user and verified email; Google admission also requires exact approved subject. No automatic enrollment/linking. Real subjects/UUIDs unverified. |
| B584 | PASS manifest / BLOCKED provisioning | `uat-provisioning-manifest.json` records four approved emails/personas and explicit null real IDs/evidence. Permissions remain unapproved empty arrays. No privileges inferred from roster approval. |
| B585 | PASS policy / BLOCKED configuration | Preview-only gate unchanged; Production rejected. Twelve candidate names missing from inspected Preview snapshot; ten absent/empty locally. See environment policy. No remote values decrypted or updated. |
| B586 | PASS disposable PG / BLOCKED actual runtime | 18 auth and 7 broker checks use real restricted TLS PostgreSQL logins, not SET ROLE impersonation. Intended actual auth/broker connection variables absent locally. Administrative catalog observations do not certify runtime login or RLS. |
| B587 | PASS design / BLOCKED entry | Compared individual Vercel collaborator access against separate protected gateway. Hobby one-collaborator limit cannot admit four simultaneously. No access mechanism activated. |
| B588 | PASS local | Invalid/fifth identities, invitation expiry/replay, MFA failure, revoked membership, cross-tenant denial covered by existing workflow/provider/SQL suites. New integration tests add native revocation, missing cookie halves, host rejection, CSRF, inactive employment and explicit dual-login mapping. |
| B589 | PASS local | Repository 802/802; disposable PostgreSQL 25/25; browser 28/28. Zero final failures/skips. Eight integrated browser cases also rerun after final native-revocation boundary change, all pass. |
| B590 | PASS package / NO-GO hosted | This report, exact changed paths, provisioning manifest, environment policy, access comparison and source receipt. |

Four-persona results use synthetic accounts only:

| Persona | Local application authorization | Real hosted identity |
| --- | --- | --- |
| Platform administrator | Governance-only page and native audit API; carrier state denied; MFA aal2 required | BLOCKED: UUID, subject, principal, permissions and independent governance namespace unresolved |
| Carrier administrator | Existing Operations UI/API after verified native session; MFA aal2 required | BLOCKED: identity and carrier tenant unresolved |
| Fleet administrator | Existing fleet-scoped Operations UI/API | BLOCKED: identity, fleet and carrier unresolved |
| Driver / fourth QA persona | Existing driver-scoped Operations UI/API; inactive employment denied | BLOCKED: identity, tenant, fleet and employment evidence unresolved |

Platform authorization already exists in native Operations, but requires a separate approved governance namespace. It is not modeled as a carrier membership. Driver employment in the current native model is an active principal plus matching active driver/fleet record; the manifest requires evidence of the approved relationship before adapters can accept it.

Browser limits: tests use a synthetic HTTPS origin forwarded into a loopback fixture with server-generated signed test JWTs and no real Google/mail calls. Playwright bypasses interception on redirect chains, so the fixture converts same-origin 303 responses into fresh meta-refresh navigations. Real HTTP 303 callback behavior is asserted independently in integration tests. Browser tests cover four personas at 390/1440, refresh, session reads, logout and unreadable HttpOnly session cookies. These results certify neither hosted Google consent/callback settings nor real tester access.

Final logs are outside the worktree under `C:/Cdev/I-WAY/pkg/dist/b581-b590/`:

- `b589-verify-final.log`: npm run verify (source syntax/conflicts, build, repository tests, public IP scan, site checks).
- `b589-auth-postgres.log`: explicit opt-in disposable auth cluster, 18 checks.
- `b589-broker-postgres.log`: explicit opt-in disposable broker cluster, 7 checks.
- `b589-browser-final.log`: complete browser run, 28 checks.
- `b589-integrated-browser-final.log`: latest integrated browser rerun, 8 checks (subset, not added to total).

Initial database commands omitted fixture opt-in and failed before the intended checks; rerun using the documented isolated runner/opt-in passed. Initial new browser forwarding tests failed because redirected `.invalid` origins escaped Playwright interception; the fixture-only adapter corrected this. These attempts are retained in local diagnostic logs and are not counted as passing runs.

Secret handling: root `.env.local` confirmed ignored and untracked. Pending 14 changed/new files were compared in memory against configured nonempty private values: zero matches. No environment file or real credential is added to this branch. Candidate packaging remains unactivated and must be reviewed again when an entrypoint is proposed.

Remaining blockers and minimum approval sequence:

1. Resolve real canonical Auth UUIDs, verified Google subjects, existing native principals, carrier/fleet IDs and driver relationship, plus approved minimum permissions and governance namespace. Supabase's last read-only inspection reported zero Auth users and zero active memberships; no provisioning was performed here.
2. Complete and certify a durable hosted Operations persistence adapter, hosted entrypoint/artifact integration, membership/relationship/control-plane lookup adapters and authorized issuance/delivery path. A local session bridge alone cannot close those engineering gaps.
3. Credential owners rotate/revoke the sensitive credentials already pasted in this conversation. Securely supply separate least-privilege auth/broker runtime logins and persistent session encryption key. Re-run genuine identity/grant/RLS/isolation checks with those actual logins.
4. Obtain explicit provisioning/role/membership/schema/provider-activation approval. Invitation issuance/delivery remains separately prohibited until approved.
5. Approve either eligible Vercel billing plus four individual protected Preview shares, or a separate protected origin/gateway and its costs. Preserve current SSO. Approve the exact genuine Preview deployment, stable origin and OAuth callback configuration.
6. Run the hosted matrix in `b561-b580-hosted-matrix.csv` for all four real testers, fifth-user rejection, cross-tenant and resource ownership denial, invalid/expired/replayed invitations, MFA failure, refresh/logout and administrative revocation. Hosted Google E2E and real restricted-runtime certification: NOT RUN / BLOCKED.

Approval is necessary at these boundaries but cannot replace the outstanding engineering and hosted validation evidence. No hosted GO is implied by local test success.
