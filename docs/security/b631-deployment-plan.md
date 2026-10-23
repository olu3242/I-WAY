# B631–B650 — Isolated Preview delivery and rollback plan

Status: **review-only; hosted delivery BLOCKED**. No push, build upload, deployment, promotion, alias assignment, migration, provisioning, invitation, billing or protection change was performed by this review.

Reviewed source baseline: `b744cdc80d2cd2b9d5d0629baa2e044244cbc084`, branch `work/b561-b580-external-uat`. This document is a subsequent local preparation change; a later reviewed commit must identify its own exact SHA. Environment and Git facts below reuse the dated B611–B620 inspection artifacts under `C:/Cdev/I-WAY/pkg/dist/b611-b620/`; they are snapshots, not newly executed hosted checks.

## Delivery trigger boundary

Both `i-way` and `iway-auth-staging` are Git-linked to `olu3242/I-WAY`, with production branch `main`. The public `i-way` project has Git deployment creation enabled. Staging disables Git deployment creation and repository-dispatch events. Consequently a feature-branch push can still trigger a Preview on the public project. Affected-project skipping does not prohibit deployment. The inspected workflows run tests/build checks and do not provide a suppression gate for Vercel's separate integration.

Keep the candidate local. Do not push merely to make it available to a deployment tool. A later owner-approved delivery can use an exact-SHA, allowlisted local staging package sent directly to the isolated staging project, avoiding a Git push and its public-project trigger. This route still requires deployment approval and a completed hosted application package. It is not currently executable as a certified four-persona release.

## Confirmed package and runtime gaps

| Evidence | Current behavior | Required work before full hosted UAT |
| --- | --- | --- |
| Root `vercel.json` | Static `site/public` output | Never deploy the repository root as the application candidate; preserve the public/private boundary |
| `scripts/package-auth-staging.mjs` | Recursively copies imports of `operations-auth-runtime.mjs`, CA certificate, one auth entrypoint, minimal public 404, dependency metadata; writes an external hash manifest | Build and test a separate explicit allowlist for the integrated application; never broaden to the repository, docs, prototype or private environment files |
| `deploy/auth-staging/api/index.mjs` | Calls `createAuthRuntime`, not `createUatCandidateRuntime` | Wire a reviewed hosted UAT entrypoint with all required dependencies; ordinary auth-only packaging cannot activate the candidate |
| `deploy/auth-staging/vercel.json` | Routes health, auth and resource verification only; catch-all 404 | Add and test intended `/uat/*`, Operations API, workspace and required static-asset routes in an isolated application package; preserve deny-by-default routing |
| `server/operations-uat-runtime.mjs` | Requires explicit activation, genuine Preview, exact staging project, restricted auth/broker connections, verified roster and injected bindings | Supply reviewed verifier, administrator authenticator, issuance authorizer, recovery issuer, delivery adapter, control-plane membership and relationship verification; do not fabricate permissive callbacks |
| `server/operations-uat-application.mjs` | Integrates auth with an injected native Operations store/engine and governance namespace | Provide durable hosted Operations services, verified native identity bindings and the actual approved platform namespace; auth-only handler fallback is insufficient |
| `server/operations-store.mjs` and Operations engine | Synchronous `node:sqlite` local store | Complete durable persistence, native identity/session/revocation parity and application command integration; ephemeral function SQLite is not an acceptable hosted substitute |
| `server/operations-postgres.mjs` | Async PostgreSQL readiness contract explicitly reports engine integration BLOCKED | Adapt all required Operations commands, queries, authorization, sessions, audit and transaction semantics and verify parity before wiring a hosted application |
| Hosted catalog and Preview variable inspection | Broker role/schema absent; all 12 candidate Preview keys absent; no verified identities/memberships | Approved schema/runtime configuration and actual restricted-login checks, then separately approved identity provisioning and access grants |

The PostgreSQL adapter's local contract tests and the local SQLite application browser tests establish different evidence. Neither demonstrates an integrated durable hosted Operations application. Adding route rewrites or environment flags cannot close that gap.

The current packager records a dirty-worktree flag but does not reject dirty input or independently enforce an expected source SHA. Before approved delivery, export only reviewed allowlisted blobs from the exact approved commit into an empty staging directory, or run the reviewed packager from a verified detached checkout of that commit. Validate the resulting manifest and require clean input. Do not include this internal plan in deploy output. Lockfile development metadata can remain internal dependency metadata, but installation must omit development dependencies; review the final installed runtime inventory as well as source files.

## Approval-gated delivery sequence

1. Finish and locally verify durable Operations integration and the isolated application entrypoint/package. Commit the reviewed implementation locally and record its full SHA, source manifest, package hashes, dependency lock integrity, targeted test receipts and secret-scan scope. Existing local certification remains tied to its original source/evidence; new implementation needs affected regression.
2. Obtain explicit approval for the exact isolated staging project `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`, target **Preview**, source SHA, package hash, approved HTTPS origin/callback and any required database migration or configuration changes. Deployment approval does not imply user provisioning, invitation, billing or protection approval.
3. Verify restricted auth, broker and Operations runtime identities using their own logins. Validate `session_user`, `current_user`, TLS, no elevated memberships/ownership, exact grants, RLS/FORCE RLS and tenant denial. Catalog inspection through an administrative connector is supporting evidence only. Never substitute the registration identity or service-role key.
4. Configure only approved Preview-scoped names through an authorized secure mechanism. Preserve the runtime's Production-target rejection. Use the genuine platform-provided Preview/project metadata; never relabel a Production deployment. Review Google-to-Supabase and Supabase-to-application callbacks separately, signup policy and identity mapping. Origin/redirect identifiers remain unresolved until approved.
5. Reinspect the project/target and protection immediately before the authorized upload. Use a clean exact-SHA allowlisted package with an explicit staging project binding; do not invoke the CLI from the repository root. Do not use Production flags, promote a Preview or change the public project's aliases. Record returned deployment ID/URL, actual source/package metadata, actual target and protection after deployment.
6. Keep all-deployment SSO enabled. First perform owner-authorized protected health checks and verify fail-closed behavior, expected headers, intended routes and absence of docs/prototype/private-file exposure. Any automation access mechanism requires its own approval; never create a bypass credential implicitly.
7. Obtain separate approvals for eligible-plan costs if needed, individual external shares to the four approved emails, real identities/memberships/relationships, privileged MFA and invitation delivery. Do not automatically add team members or create administrators. Then execute the prepared 84 hosted scenarios and 48 human accessibility checks with sanitized evidence. Until those prerequisites pass, hosted cases remain BLOCKED.

## Health and evidence gates

- Record a sanitized health response, status, deployment ID, actual Preview target and exact artifact/source receipt. A healthy auth-only endpoint does not prove the four-persona application is deployed.
- Exercise intended auth/UAT/workspace/API routes and static assets; require 404/403 for internal docs, prototype, private files, unauthorized workspaces and cross-tenant resources. Record no cookies, tokens, OAuth parameters or invitation fragments.
- Verify runtime unavailable/configuration failure returns a controlled failure; Google/provider failure, password MFA, refresh/logout/revocation and membership/relationship removal must deny access consistently across parent and native sessions.
- Stop release progression on missing identity proof, unexpected privileged role, RLS bypass, tenant leakage, dead critical workflow, unprotected access or source/target mismatch. Do not weaken a gate to obtain a passing health check.

## Containment and rollback

The last inspected deployment `dpl_APs1ZkJVQfADo9H8Vq6wxDFBfPNc` is READY at old source `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`, target Production inside staging. It is not a verified safe replacement for the candidate and cannot satisfy the candidate's Preview-only runtime gates. Do not blindly promote, redeploy or restore its authentication configuration as a rollback.

Before any approved activation, record the current staging-only alias assignments, protection, schema revision, approved runtime grants and eligible known-good deployment, if one exists. Specify the owner authorized to contain a failure. Prefer withdrawing the failed Preview from tester use, revoking its approved individual shares and application sessions under explicit incident/rollback authorization, and keeping SSO enforced. Restore an alias only to an independently verified compatible staging deployment, if approved. If none exists, remain unavailable to testers instead of falling back to privileged credentials, local fixtures or an incompatible Production deployment.

Database changes require a separately reviewed compatibility/restore plan and approval. Do not drop schemas, remove RLS or destroy audit/session records as an automatic deployment rollback. Preserve sanitized incident evidence; disable further activation until the failed gate is understood. The public site's production deployment, aliases, credentials and data remain outside this plan.

## Decisions

| Gate | Decision |
| --- | --- |
| Existing certified local workflows | GO within previously recorded coverage |
| Full durable hosted application package | BLOCKED by integration and binding work |
| Git push | NO-GO without explicit approval and resolved linked-project trigger consequences |
| Preview activation | NO-GO until engineering/configuration gates and exact-artifact deployment approval |
| Four-persona hosted UAT | NO-GO until identity, protected entry and hosted evidence gates pass |
| Production release | NO-GO; outside this authorized preparation scope |
