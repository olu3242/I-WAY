# B561–B580: external tester access and dual authentication

Historical B580 receipt. Subsequent B581–B590 review, commits and evidence supersede its working-tree and test-count snapshot.

Date: 2026-10-23, America/Chicago. **Hosted UAT: NO-GO. Local candidate engineering checks: PASS.** No hosted accounts, permissions, provider configuration, Vercel protection, billing, invitations, deployments or main-branch changes were performed. All new credential issuance and email delivery in tests used synthetic in-process adapters.

Branch: `work/b561-b580-external-uat`, isolated at `.worktrees/b561-b580-external-uat`, based on exact deployed source `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`. The 18 new files are uncommitted, reviewable local additions; HEAD remains the base commit. No merge or deployment is authorized by this report. Evidence snapshot: [b561-b580-inspection.json](b561-b580-inspection.json). Approved, unresolved identity roster: [uat-approved-roster.json](uat-approved-roster.json).

## Verified state and corrections

Vercel deployment `dpl_APs1ZkJVQfADo9H8Vq6wxDFBfPNc` is READY in `iway-auth-staging`, project `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, team `team_zNHlJbJHa4YZFwN4p9lcHzEH`. Its metadata matches the source commit above and identifies a Production target inside the isolated staging project. Project protection is enabled for all deployments. An unauthenticated request to that deployment's `/api/health` returns HTTP302 to `vercel.com`; no bypass was used.

The team billing API reports **Hobby**, active. The pinned Supabase project `vnoxdinldneeczxibicp` reports **zero Auth users and zero active tenant memberships**. This is consistent with the user's clarified provisioning status, not with earlier claims that four accounts were already created. Read-only catalog evidence shows `iway_auth_runtime` exists and is not superuser/BYPASSRLS/CREATEROLE/CREATEDB. This administrative read does not prove its password, actual session identity or hosted RLS behavior.

The deployed runtime explicitly requires `VERCEL_ENV=preview`. A Vercel Production target does not satisfy that gate even when the project is named staging. That gate was preserved. A fresh genuine Preview deployment, approved exact origin/callback and correct Preview variables are prerequisites; overriding the platform environment to disguise Production is not an acceptable fix.

Current project variable-name metadata contains ten Production names and no Preview names. Only `IWAY_AUTH_PROVIDER` and `IWAY_AUTH_ORIGIN` match the nine expected application auth names. Missing in Production: `IWAY_AUTH_DATABASE_URL`, `IWAY_SESSION_ENCRYPTION_KEY`, `IWAY_SUPABASE_PUBLISHABLE_KEY`, `IWAY_AUTH_ENABLED`, `IWAY_AUTH_SCHEMA_APPROVED`, `IWAY_AUTH_APPROVED_ORIGIN`, `IWAY_STAGING_VERCEL_PROJECT_ID`. All nine are absent from Preview metadata. `DATABASE_URL` and Google client credentials do not replace that contract. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are not needed by the application auth adapter. Names are not evidence of valid secret values or of the deployed environment snapshot; nothing was decrypted.

The public JWKS endpoint responds with one ES256 key. That algorithm is supported by the existing signature verifier. No real Google/provider token was requested or verified. Live key pinning, rotation, token expiry and MFA assurance still need integration verification.

## External entry design

**Preferred: retain Vercel Authentication and use four individually approved external collaborators on an approved genuine Preview branch after an owner-approved Pro upgrade.** Testers use their own Vercel accounts for the deployment gate, followed by their own I-WAY Google or email/password identity. They do not become team members. Access remains revocable per person. Record each grant, its approved branch, the tested commit, expiry/review date and revocation owner. A branch grant can follow later deployments: do not describe it as authorization for only one immutable commit. Do not grant access to the current Production target under a Preview-only approval.

Vercel documents individual invitations/access requests, one external collaborator on Hobby and multiple on Pro/Enterprise. Therefore the current plan cannot accommodate all four using this method. External access still requires a Vercel account when the deployment is protected. Invitation/approval is a separate authorized action, not team membership. [Vercel sharing documentation](https://vercel.com/docs/deployments/sharing-deployments)

Owners, members, admins and developers can approve deployment access requests; settings changes require the applicable project/team authority. Confirm the acting operator's actual role before doing so. [Vercel Authentication permissions](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)

Pro is currently advertised at **$20/month**, with usage and applicable team charges to be confirmed at checkout. Do not purchase or change billing without approval. This is a plan prerequisite for multiple collaborators, not approval to buy seats or add testers to the team. [Vercel pricing](https://vercel.com/pricing)

All-deployments Vercel Authentication itself is now free on every plan; the old blanket claim that this SSO scope necessarily requires the $150 add-on is outdated. The external collaborator limit is a separate constraint. [September 2026 Vercel announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)

**Alternative if Pro is declined:** provision a separate UAT host behind an individually authenticated identity-aware gateway, limited to the four approved subjects, with a private/locked origin that cannot be reached directly. Retain the existing Vercel project's SSO unchanged. The gateway forwards only to the new UAT host, not through the currently protected Vercel deployment using a shared bypass. The application still performs its own subject/UUID/role/tenant/relationship checks. A provider, exact origin, ownership, cost and infrastructure/firewall design must be selected and separately approved before implementation; none was created. A shared password, publicly accessible alias, reverse proxy that silently bypasses current SSO, or reusable automation token is not the human entry design.

## Approved identities and actual authorization gaps

| Approved tester | Intended persona | Existing identifiers/relationships |
| --- | --- | --- |
| `oadeyemo306@gmail.com` | Platform administrator | Control plane only; no carrier/fleet assignment; Auth UUID and Google subject pending |
| `martin@tm88investments.com` | Carrier administrator | Auth UUID, Google subject and carrier tenant ID pending |
| `info@tm88investments.com` | Fleet company administrator | Auth UUID, Google subject, fleet ID and parent tenant ID pending |
| `cassiomey@gmail.com` | Driver / fourth QA persona | Auth UUID, Google subject, principal ID, tenant, fleet and employment relationship pending |

The user reaffirmed this list during this session and cited earlier discussions; those earlier records were not independently retrieved. Email approval is not a provisioned account, Google subject binding, privilege grant or membership. The executable roster validator rejects null IDs and subjects, duplicate bindings, missing relationships, unsupported permissions and any roster other than the four distinct personas. No real UUID, Google subject, tenant or fleet was invented. Synthetic fixture IDs are explicitly labelled and are not provisioning proposals.

The repository supports platform governance permissions (`platform:invite`, `platform:audit`) while denying platform users operational tenant authority. However, deployed `auth_tenant_roles` requires a tenant ID, and its existing platform audit path is tenant-scoped. A tenant-free platform-control-plane membership lookup and actual control-plane workflows are **not verified as deployed**. The candidate runtime requires a separate trusted control-plane membership adapter and relationship verifier; missing adapters fail before pools start. Do not force the platform tester into a carrier tenant to satisfy the schema. The owner must approve each persona's minimal UAT permission set; the tests' read-only synthetic grants are not real grants.

## Implemented local candidate

The new runtime is opt-in code and is **not imported by the deployed entrypoint or its existing packager**. A local package check confirmed that the existing 18-file runtime allowlist excludes the candidate. No candidate package was uploaded.

* `operations-uat-workflow.mjs`: four-bound-identity admission, current membership/relationship checks, approved MFA administrator issuance, issuance-approval callback, setup/recovery, Google/password convergence on the same UUID, five-minute MFA step-up, version-bound sessions, refresh/logout and revocation. Role and tenant claims from client bodies do not grant authority.
* `operations-uat-provider.mjs`: server-side password grant, recovery-token verification, user-scoped password update, refresh and pre-enrolled TOTP challenge/verification. It verifies JWT signatures, issuer, audience and expiry through the existing trusted verifier and independently fetches the current provider user. No `user_metadata` authorization, signup, account-linking or administrative key is part of the application adapter.
* A separate control-plane issuer uses an injected authorized Supabase admin client's **recovery** link generation for an already provisioned UUID and rejects a mismatched UUID. The application never receives that admin client. Delivery is an injected approved transport, absent from the deployed code. No real delivery adapter or operator administration session was configured.
* `operations-uat-http.mjs`: private dual-choice sign-in/setup forms; same-origin POST enforcement; bounded JSON bodies with a timeout; no query-string credentials; HttpOnly Secure session/MFA cookies; no-store/referrer/CSP headers; opaque handles; PKCE callback browser binding and one-time use. Setup tokens arrive in a URL fragment, are removed from browser history immediately, and are posted only in the request body. Delivery must construct a fixed approved-origin `/uat/setup#<opaque-token>` link with no tracking or URL shortening.
* `operations-uat-postgres.mjs`: shared transactional state, encrypted provider setup material/MFA tokens, hashed invitation/session handles, concurrent single-winner redemption, durable rate windows, session epochs, append-only audit and expiry cleanup. It requires a separate genuine `iway_uat_runtime` login, rejects administrator/SET ROLE impersonation, validates grants/RLS/ownership, and rejects unrelated data access, writable identity columns and wrapper views. The existing `iway_auth_runtime` remains responsible for its own session/resource schema. The broker handles control metadata across the four users; it receives no carrier/fleet business-data grants.
* `iway_uat_state_b574.sql`: **review-only proposed** private schema/RLS/grants, executed only in the disposable local fixture. It is not a linked migration, not provisioned in Supabase, and contains no password or role-creation command. No real broker login exists by implication.
* `operations-uat-fixture-store.mjs`: guarded SQLite backend for local tests only. Never use this adapter for Vercel persistence.
* `operations-uat-runtime.mjs`: candidate assembly with two restricted pools and fail-closed roster, schema, project, origin, provider and Preview gates. Proposed additional names are `IWAY_UAT_ENABLED`, `IWAY_UAT_SCHEMA_APPROVED` and `IWAY_UAT_DATABASE_URL`; no values were added anywhere. Requires injected administrator, issuance approval, delivery, control-plane membership and relationship implementations. Startup cleanup exists; a reviewed periodic maintenance/operator invocation still needs wiring.

Setup is not a temporary Google password. The user selects their own I-WAY/Supabase password after one-time proof; no application plaintext password column exists. Setup validity defaults to one hour and cannot exceed 24 hours. Consumption is atomic; expired, revoked and superseded invitations deny and retain evidence. Setup proof never creates an application session. New setup/recovery invalidates existing application sessions. A provider operation already in flight may have an uncertain external outcome; the application stays denied and requires fresh approved recovery rather than replaying proof or attempting a password rollback.

Supabase invitations are not interchangeable with OAuth PKCE callbacks. This candidate uses a separately controlled recovery verification flow for pre-provisioned accounts. [Recovery/password documentation](https://supabase.com/docs/guides/auth/passwords), [admin link generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)

Supabase may link verified identities by email automatically. The application does not equate matching email with approved Google identity: it additionally requires the recorded Google subject, canonical user UUID and current membership. Real onboarding must verify the provider's signup/linking settings and record subject mappings; no automatic linking call was added. [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)

Platform and carrier sessions require verified `aal2`. Low-assurance password or Google sign-in receives an opaque, expiring step-up handle instead of application access. The adapter supports already enrolled TOTP factors; no enrollment UI, factor, recovery exception or MFA bypass was created. Approved enrollment and recovery procedures remain prerequisites for privileged testers. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

Public changelog review found the upcoming HTTP TLS cipher retirement and free-tier email-template restrictions. The implementation uses Node24 HTTPS and no obsolete-cipher override. Branded setup delivery needs an approved transport/SMTP workflow; changing a new free-tier project's default templates cannot be assumed available. These changes do not justify weakening TLS or enabling email automatically. [TLS change](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), [email change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

## Local evidence

| Check | Passed | Failed | Skipped | Scope |
| --- | ---: | ---: | ---: | --- |
| Final `npm run verify` | 790 | 0 | 0 | Source syntax, build, repository tests, IP scan and site checks PASS |
| New candidate tests included above | 24 | 0 | 0 | Workflow, HTTP, signed adapter and activation gates |
| Existing isolated auth PostgreSQL suite | 18 | 0 | 0 | Real local `iway_auth_runtime`, RLS, four roles, tenant boundaries, session lifecycle |
| New isolated UAT PostgreSQL suite | 6 | 0 | 0 | Real local `iway_uat_runtime`, shared storage, concurrency, restart, audit, privilege drift |
| Full local browser suite | 20 | 0 | 0 | Includes 2 candidate setup/password/MFA cases at 390px and 1440px |
| Candidate browser rerun after asynchronous-storage changes | 2 | 0 | 0 | Same two cases; not additional coverage to sum into 22 |
| Actual-provider/hosted four-user UAT | 0 executed | — | — | NOT RUN; gates remain blocked |

Logs are ignored local artifacts in root `dist/b561-b580/`: `verify.log`, `postgres.log`, `uat-postgres.log`, `browser.log`, `uat-browser-final.log`. Candidate browser tests intercept an HTTPS test origin into a loopback server and simulate provider responses; they are not live Google E2E. Existing local PostgreSQL tests and the new broker suite use separate logins, not an administrator changing roles. Administrative fixture setup is confined to a newly created disposable cluster.

The first browser attempt exposed an asynchronous form-reference error in MFA completion; it was corrected and both widths pass. Review also caught a short-window cleanup rule that could erase a longer account-limit window; expiry is now tracked per bucket and has a regression test. Earlier passing test runs are superseded by the final results above. No initial failures were counted as hosted acceptance.

## Batch decisions

| Batch | Result |
| --- | --- |
| B561 | PASS: exact deployed source and target confirmed |
| B562 | PASS: SSO/all-deployments protection confirmed; unchanged |
| B563 | Design complete; BLOCKED for four collaborators on current Hobby plan |
| B564–B566 | BLOCKED: approved email roster exists, actual identities/Google mappings/tenant relationships do not |
| B567–B570 | Hosted NOT RUN; four-person UAT NO-GO |
| B571–B572 | PASS: OAuth-only deployed adapter inspected; password and production/preview gaps identified |
| B573–B575 | Local candidate PASS; real issuance, enrollment and hosted integration BLOCKED |
| B576–B578 | Local mapping, deny-by-default authorization, expiry/revocation/rate/recovery checks PASS; real bindings and schema unapplied |
| B579 | Local tests PASS; actual Google/password provider acceptance NOT RUN |
| B580 | This report and hosted matrix complete; hosted UAT NO-GO |

## Exact changed files

All paths below are relative to the isolated worktree; no public site, deployed entrypoint, existing protection setting or main file was edited.

1. `db/review-only/iway_uat_state_b574.sql`
2. `docs/security/uat-approved-roster.json`
3. `docs/security/b561-b580-inspection.json`
4. `docs/security/b561-b580-external-uat.md`
5. `docs/security/b561-b580-hosted-matrix.csv`
6. `server/operations-uat-fixture-store.mjs`
7. `server/operations-uat-http.mjs`
8. `server/operations-uat-postgres.mjs`
9. `server/operations-uat-provider.mjs`
10. `server/operations-uat-runtime.mjs`
11. `server/operations-uat-workflow.mjs`
12. `tests/browser/uat.spec.mjs`
13. `tests/helpers/uat-fixture.mjs`
14. `tests/local/uat-postgres.test.mjs`
15. `tests/operations-uat-http.test.mjs`
16. `tests/operations-uat-provider.test.mjs`
17. `tests/operations-uat-runtime.test.mjs`
18. `tests/operations-uat.test.mjs`

## Minimum approvals and remaining implementation gates

Approval alone does not resolve the implementation and configuration gaps. Before hosted UAT can begin:

1. **Access/billing decision:** owner approves Pro billing (or a separately costed gateway/host), then individually scoped external collaborator access for the four real testers on the approved genuine Preview branch. Keep SSO/all-deployments protection. Do not grant team membership, Production access, or create bypass credentials. Confirm exact plan cost and operator permissions at execution.
2. **Provisioning decision:** approve creation of the four Auth users, a synthetic carrier tenant and fleet, the driver's employment relationship and explicit minimal permission sets. Record database-generated IDs after creation; verify each Google subject → Auth UUID independently before activating the executable roster. A separate approved control-plane model is required for the platform tester. No real administrator account is created automatically.
3. **Schema/credential decision:** review the proposed broker schema and least-privilege role, authorization of every grant and its maintenance/retention contract; provide credentials through a secure workflow. Apply only after explicit approval and fresh catalog review. Authenticate as each actual restricted runtime and repeat identity/grant/RLS/isolation tests. An administrator catalog result is insufficient.
4. **Integration work:** implement the trusted control-plane membership and current fleet/employment resolvers against approved records, configure the separately authorized operator session/issuer/delivery transport, pin/rotate the verified public signing keys, and wire periodic cleanup. The candidate provides authentication/session/resource-verification surfaces; it does not yet bridge all existing application UIs to provider-backed sessions. Complete and test that bridge and each intended role workflow. Match the candidate route allowlist/packager explicitly; the existing deployment packaging intentionally excludes this code. Validate trusted network identity/rate limits in the hosting environment rather than trusting client forwarding headers.
5. **Provider/configuration decision:** approve and configure password recovery, Google callback, any provider signup restrictions and privileged MFA enrollment; populate the exact application Preview names and separately protect control-plane credentials. Do not put a Supabase admin client/key into the application runtime. Do not send setup links until issuance and delivery recipients are explicitly approved.
6. **Deployment decision:** approve a reviewed exact commit and genuine Preview deployment of the completed candidate in the isolated staging project. Record its actual origin/callback instead of inventing a URL. Then run [the hosted matrix](b561-b580-hosted-matrix.csv), including fifth-user rejection, revoked grants, missing MFA, stale sessions and cross-tenant/fleet denial. Record rollback and revoke all UAT grants at closure.

**Decision: local engineering candidate PASS; real-tester and hosted UAT NO-GO.** No account, invitation, purchase, access grant, provider activation, deployment or merge was performed.
