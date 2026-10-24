# I-WAY B761–B780 — Approval matrix

All decisions are pending. This document is an approval package, not authorization. No listed operation was executed. Exact commit/checksum approval must reference the final post-commit verification file. No Production changes, protection bypass, team membership or billing changes are included.

## A01 — Optional; not an activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** olu3242/I-WAY refs/heads/work/b561-b580-external-uat

**Intended change:** Optional publication of the final local certification commit only; no main merge.

**Required owner:** Repository maintainer; Vercel owner for any separate build cancellation

**Dependencies:** None

**Prerequisites:** Separate explicit Git push approval naming final SHA Verify committed branch suppression and both Vercel projects immediately before push

**Security risks:** A push can trigger Git-integrated builds if effective policy differs; local hook is not installed.

**Verification:** Compare advertised ref with approved SHA; inspect both project deployment histories; confirm no Production deployment.

**Rollback:** Stop any unexpected build under owner approval; preserve audit and branch guard; no force-push or reset.

**Owner decision / approved SHA / expiry:** [TBC].

## A02 — Optional; not an activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Vercel team_zNHlJbJHa4YZFwN4p9lcHzEH; staging prj_7uof3CdmN1QvzKxETkXvHjlrLjVm; public prj_0vutnbiNCYaxhdrbLfktrsHAvxty

**Intended change:** Conditional isolation repair only if fresh inspection finds drift: keep staging Git creation/dispatch disabled, staging SSO all, and public branch suppression for work/b561-b580-external-uat. Do not broaden protection or change main.

**Required owner:** Vercel project owner

**Dependencies:** None

**Prerequisites:** Fresh whitelisted settings snapshot Approve exact changed settings and previous values; current settings need no mutation

**Security risks:** Incorrect project or branch scope can interrupt public releases or open access.

**Verification:** Re-read both project settings; compare root and isolated vercel.json; verify candidate branch disabled and staging SSO all.

**Rollback:** Restore only the reviewed previous isolation values while retaining protection; stop if restoration would broaden access.

**Owner decision / approved SHA / expiry:** [TBC].

## A03 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Supabase vnoxdinldneeczxibicp / postgres; iway_auth_runtime, iway_uat_runtime, iway_operations_runtime; optional separate iway_uat_management_runtime

**Intended change:** Credential owner supplies fresh private restricted credentials and creates only approved missing LOGIN roles. Any credential rotation needs separate explicit credential-owner approval.

**Required owner:** Database credential owner / authorized database administrator

**Dependencies:** None

**Prerequisites:** Owner attests database target is approved staging and will not modify production/shared production workloads Exact role/grant profile and credential delivery channel approved Plan for zero memberships on broker/Operations/management; managed non-superuser creation may introduce an inbound ADMIN edge

**Security risks:** Managed creator edges can fail strict installation/runtime checks; elevated or reused public/production credentials defeat isolation.

**Verification:** Genuine TLS connections as each role; session_user=current_user=expected role; no administrator SET ROLE Auth B533 allows only its existing bootstrap-granted postgres ADMIN edge with INHERIT=false and SET=false; reject all outbound/other edges Broker/Operations/management require their strict installer and runtime membership checks; unresolved creator edge stays BLOCKED

**Rollback:** Disable activation and revoke candidate sessions; owner may disable new login credentials under separate approval; retain all rows/audit and preserve existing auth edge.

**Owner decision / approved SHA / expiry:** [TBC].

## A04 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Supabase vnoxdinldneeczxibicp / postgres / iway_uat_private

**Intended change:** Apply only the checksum-bound db/review-only/b631-broker-remediation.sql, then its read-only verifier; do not also apply the older B574 CREATE SCHEMA file.

**Required owner:** Authorized staging database administrator

**Dependencies:** A03

**Prerequisites:** A03 broker role and exact membership preflight pass Fresh absence-or-complete-schema catalog, owner snapshot/restore point, SQL hashes approved Local PostgreSQL 17 rehearsal passes; no automatic linked migration command

**Security risks:** Partial schema or unrelated grants fail installation; control metadata spans the roster and must not gain business-table privileges.

**Verification:** Read-only b631-broker-verify.sql; genuine assertUatPostgresRuntime; six FORCE RLS tables, exact grants, schema/client isolation and encrypted proof persistence.

**Rollback:** Failed transaction rolls back; after successful install disable activation and revoke handles/sessions; preserve schema/state/audit. No destructive down migration.

**Owner decision / approved SHA / expiry:** [TBC].

## A05 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Supabase vnoxdinldneeczxibicp / postgres / operations_private, operations_migrations, operations_engine_private

**Intended change:** Apply the four ordered Operations migrations and then db/review-only/b662-operations-engine.sql exactly as hashed in the migration package; no identity or tenant seeding included.

**Required owner:** Authorized staging database administrator

**Dependencies:** A03

**Prerequisites:** A03 Operations role and strict runtime membership conditions satisfied Fresh schema/version/checksum preflight and owner snapshot/restore point Owner confirms no production/shared workload affected; review exact SQL and minimal grants

**Security risks:** Wrong migration order, existing checksum drift, or engine ownership/privilege errors prevent readiness.

**Verification:** Migration checksum ledger; five engine tables ENABLE/FORCE RLS; runtime SELECT only plus state UPDATE(payload,version), audit INSERT; tenant/actor denials and audit rollback.

**Rollback:** Failed transaction rolls back; after success disable candidate activation, revoke candidate sessions and preserve state/audit; restore only via separately approved recovery plan.

**Owner decision / approved SHA / expiry:** [TBC].

## A06 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Vercel prj_7uof3CdmN1QvzKxETkXvHjlrLjVm Preview only

**Intended change:** Set all 13 names from environment-contract.json using owner-supplied values; DB URLs and encryption key are Secrets. Bind exact approved Preview origin; activation stays off until all gates pass.

**Required owner:** Vercel project owner and credential owner

**Dependencies:** A03, A04, A05

**Prerequisites:** A03–A05 verified Exact owner-approved Preview origin and callback registration recorded Private validation of values; no copying legacy DATABASE_URL/service-role/OpenAI credentials Genuine platform VERCEL_ENV=preview and pinned VERCEL_PROJECT_ID, never manual overrides

**Security risks:** Wrong scope/origin, accidental Production target, or privileged credential substitution.

**Verification:** Names/scope listing and private offline contract validation; real restricted login postflight; compare only metadata.

**Rollback:** Disable candidate activation; revoke sessions; remove or restore only reviewed Preview entries without changing Production.

**Owner decision / approved SHA / expiry:** [TBC].

## A07 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Supabase vnoxdinldneeczxibicp Auth Google/password providers and redirect allowlist

**Intended change:** Approve exact application origin/callback, signup/linking policy and password provider settings. Google Console changes require a separate addendum binding the owner-verified OAuth client ID; no unknown client is authorized here.

**Required owner:** Supabase Auth owner; Google OAuth client owner for separately identified addendum

**Dependencies:** A06

**Prerequisites:** Owner privately verifies bound Google OAuth client; actual client ID has not been inspected Google callback https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback Exact application origin plus /auth/callback approved without wildcard redirects Prevent unapproved signups/automatic linking; verify both methods map to an existing canonical UUID and exact Google subject

**Security risks:** Broad redirects, email-only linking or provider auto-creation can bypass intended identity controls.

**Verification:** Private configuration review, genuine issuer/audience/JWKS validation, state/PKCE tamper/replay denial and fifth-user rejection; hosted execution BLOCKED until approval.

**Rollback:** Disable candidate activation; revoke candidate sessions; restore only reviewed staging provider/redirect settings; preserve identity/audit records.

**Owner decision / approved SHA / expiry:** [TBC].

## A08 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Supabase vnoxdinldneeczxibicp Auth; four emails in docs/security/uat-provisioning-manifest.json; matching auth and Operations namespaces

**Intended change:** Provision the approved four identities and synthetic carrier/fleet/employment hierarchy only after owner approves exact permissions and recorded IDs. Establish privileged TOTP through a separately approved controlled enrollment flow.

**Required owner:** Authorized identity administrator, tenant owner and each tester for own authenticator enrollment

**Dependencies:** A04, A05, A07

**Prerequisites:** Canonical Auth UUID/Google subject/native-principal evidence recorded; no email-only linking Owner-approved platform governance namespace, carrier tenant, child fleet and driver employment IDs Explicit platform/carrier privilege approval and controlled TOTP enrollment route; current app requires pre-enrolled verified factors

**Security risks:** Wrong hierarchy or administrator privileges cause tenant escalation; QR/seed exposure compromises MFA.

**Verification:** Both login methods resolve to one exact canonical identity; platform has no carrier assignment AAL1 denied for platform/carrier; existing verified TOTP challenge yields AAL2; recovery/revocation rechecks membership Fifth-user, wrong fleet, inactive employment and cross-tenant tests deny

**Rollback:** Deactivate memberships/relationships, revoke sessions and invitations, fence broker epochs; no hard-deletion or unapproved administrator creation.

**Owner decision / approved SHA / expiry:** [TBC].

## A09 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Separate staging management process; Supabase vnoxdinldneeczxibicp; iway_uat_management_private; the four approved recipient emails only

**Intended change:** Activate separately approved B710 metadata schema, pinned existing-user recovery-link issuer and confidential delivery adapter. No privileged management credentials in the application Preview.

**Required owner:** Management-service owner, database owner and delivery-provider owner

**Dependencies:** A03, A04, A08

**Prerequisites:** A03 separate metadata role approved if activated Exact management actor UUID/permissions, roster digest, approved origin, operation scope and max-24h owner approval recorded Actual transport account/provider and process identity must be identified before final approval Reconcile any uncertain command before retry; no automatic invitation or account creation

**Security risks:** Ambiguous provider/delivery side effects, privileged credential exposure and accidental duplicate delivery.

**Verification:** Local mocks and PostgreSQL audit/idempotency tests pass; approved live test checks single confidential delivery and canonical user; audit contains metadata only.

**Rollback:** Disable issuance/delivery, revoke outstanding proofs and sessions, retain uncertainty fences and append-only audit; do not resend uncertain commands automatically.

**Owner decision / approved SHA / expiry:** [TBC].

## A10 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Vercel team_zNHlJbJHa4YZFwN4p9lcHzEH / prj_7uof3CdmN1QvzKxETkXvHjlrLjVm / genuine protected Preview

**Intended change:** Deploy only the exact final commit and artifact checksum bound in dist/b761-b780/post-commit-verification.json; no --prod, promotion, public-project target or Git-push requirement.

**Required owner:** Authorized staging release owner

**Dependencies:** A03, A04, A05, A06, A07, A08, A09

**Prerequisites:** A03–A09 verified and explicit exact-SHA/checksum deployment approval Clean committed source, reproducible artifact, delivery verifier PASS/APPROVAL_REQUIRED Fresh SSO all and genuine Preview/project gate checks; do not weaken activation checks

**Security risks:** Wrong output, project or environment can expose the public project or bypass tested gates.

**Verification:** Verify archive SHA/source blobs; protected Preview health, actual runtime identities, bindings and OAuth callback; run hosted matrix only when access is approved.

**Rollback:** Disable candidate activation and revoke sessions; retain previous deployment/evidence; roll back only the isolated candidate under owner approval without Production promotion.

**Owner decision / approved SHA / expiry:** [TBC].

## A11 — Activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Exact A10 commit-specific protected Preview; the four approved tester emails; Vercel Hobby account eduradiusllc

**Intended change:** Grant one external collaborator at a time on Hobby, revoke and verify denial before the next. Testers use their own Vercel accounts then I-WAY authentication; no team membership or bypass link.

**Required owner:** Vercel project owner and UAT owner

**Dependencies:** A10

**Prerequisites:** A10 healthy and protection remains all Exact external account correspondence approved; test schedule and expiry/revocation owner set Concurrent four-tester access requires a separately approved billing change, which is not included in this serial plan

**Security risks:** Overbroad branch/project sharing or lingering grants; Google login alone does not pass Vercel protection.

**Verification:** Individually test platform and application denial for uninvited/fifth user; confirm four personas/tenants; execute 84-case matrix and human scripts without credential capture.

**Rollback:** Revoke individual Vercel grants, app sessions and outstanding invitations; retain SSO protection and audit.

**Owner decision / approved SHA / expiry:** [TBC].

## A12 — Optional; not an activation prerequisite

**Status:** BLOCKED_APPROVAL_REQUIRED

**Exact target:** Vercel public prj_0vutnbiNCYaxhdrbLfktrsHAvxty Preview entries DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD

**Intended change:** Optional owner review and removal of unused privileged Preview entries only after dependency confirmation; no Production entry or value is changed by this package.

**Required owner:** Public Vercel project owner and credential owner

**Dependencies:** None

**Prerequisites:** Owner verifies public static build/runtime has no dependency on each named Preview entry Approve exact Preview-only changes; confirm scope changes preserve Production configuration No credential values have been read or exposure proven by this names-only audit

**Security risks:** Removing a required legacy value can break a dependent workflow; presence of names alone does not prove browser leakage.

**Verification:** Names/scope inventory after any approved removal; public build/registration preview checks; confirm Production unchanged.

**Rollback:** Owner restores only the reviewed Preview configuration privately; no secret values in Git/evidence.

**Owner decision / approved SHA / expiry:** [TBC].

## Access plan and missing identifiers

Current team plan is Hobby. [Vercel external sharing](https://vercel.com/docs/deployments/sharing-deployments) supports one active external collaborator on Hobby; sequential testing is the proposed plan. Four simultaneous external collaborators would require a separate plan/billing approval. [Current Pro pricing](https://vercel.com/docs/plans/pro-plan) starts at USD20/month plus applicable usage/tax; no upgrade is authorized or requested here. External collaborators do not become team members.

The exact Google Console OAuth client, management process identity, transport-provider account, actual hierarchy UUIDs and final Preview origin remain unknown. Actions dependent on those identifiers cannot be executed until an owner binds them to the approval record. No broad permission to mutate an unidentified provider/client is requested.

The auth creator ADMIN edge is already covered by the committed B533 exception; do not revoke it automatically or rerun the older B513 first-create role file against the existing role. Broker/Operations/management stricter checks may reject analogous managed creator edges. Resolve their provisioning method without weakening runtime checks, or keep activation BLOCKED.

Machine-readable actions: dist/b761-b780/approval-matrix.json. Ordered SQL/hash packages: dist/b761-b780/migration-approval-packages.json. Credential and runtime-login procedures are in b761-b780-activation-readiness.md.
