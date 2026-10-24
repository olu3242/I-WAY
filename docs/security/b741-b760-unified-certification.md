# I-WAY B741–B760 — Unified certification

Local covered workflows: **GO**. Protected Preview activation: **NO-GO**. External UAT: **NO-GO**. Production: **NO-GO**.

Branch: `work/b561-b580-external-uat`. Worktree: `C:/Cdev/I-WAY/pkg/.worktrees/b561-b580-external-uat`.
Starting commit: `d97938a2f2dcf0c5f5b419993d0408559cb2a9bd`; starting worktree clean.
The ending SHA is the commit containing this report and receipt. Its literal SHA, clean worktree check, receipt hash and artifact hashes are recorded in `dist/b741-b760/post-commit-verification.json` after committing, avoiding a circular self-hash.

No push, deployment, merge, hosted schema or role change, real-user creation, invitation delivery, credential rotation, billing change, access grant or protection change was performed.

## B741–B750 evidence

| Batch | Result | Evidence and boundary |
| --- | --- | --- |
| B741 baseline | PASS | 20 prior source hashes, 31 prior evidence hashes, 81 committed package blobs and all 86 staged files verified. Prior ZIP SHA-256 2fb304e48e8dcd26c0a8dddcabfc8c8262f7ca6c2210a85039a556e3e17ec16c preserved. |
| B742 isolation | PASS local / BLOCKED historical setting attribution | Both prior deployments identify Git SHA d02189b622fa29961a5d8ab743a68c1178ca1784 and public output site/public. Their commit had no branch suppression. Current staging disables Git creation, but the bounded event history does not prove the setting at the earlier push. |
| B743 Preview contract | PASS local validator / BLOCKED hosted | All 13 keys now have project, Preview scope, purpose and validation rules. Offline validation uses actual runtime resolvers and rejects invalid encryption/API credentials without serializing values. Preview has 0/13 names; local has 2/13. |
| B744 PostgreSQL 17 | PASS | Official portable EDB PostgreSQL 17.11 package matches publisher checksum. All seven disposable suites executed with expected major 17 and actual server version 170011. |
| B745 roles | PASS local / BLOCKED hosted login | Exact iway_auth_runtime, iway_uat_runtime and iway_operations_runtime LOGIN sessions, verified TLS, identical session_user/current_user, NOINHERIT/NOSUPERUSER/NOBYPASSRLS and no memberships. No SET ROLE impersonation. |
| B746 RLS | PASS local | All 16 combined application tables have ENABLE + FORCE RLS. Cross-schema access, cross-tenant writes/reads, forged actor context and absent context denied. |
| B747 schemas | PASS local / BLOCKED hosted | Exact reviewed auth upgrade, broker installer and versioned Operations files executed. Reapplication preserves records/security. Injected transaction failures roll back schema/security/data. No hosted SQL was applied. |
| B748 OAuth | PASS synthetic / BLOCKED real Google | Existing callback, PKCE single-use/state, canonical UUID, issuer/audience, exact Google subject and email-only-linking rejection tests rerun. Real provider settings and approved Preview origin unavailable. |
| B749 MFA | PASS synthetic / BLOCKED real factors | Privileged platform/carrier AAL2 and pre-existing verified TOTP requirements, missing-factor denial, recovery and revocation tested. Fixture codes/provider replies do not certify actual Google or Supabase MFA. |
| B750 management | PASS mocked / BLOCKED activation | Existing issuer, confidential delivery, denial defaults, owner approval, idempotency/concurrency and append-only audit tests rerun on PostgreSQL 17. Application issuance remains denied; separate management process not activated. |

## B751–B760 evidence

| Batch | Result | Evidence and boundary |
| --- | --- | --- |
| B751 Platform Admin | PASS local | Governance namespace, audit, privileged MFA, refresh/logout/recovery and denial of carrier workspace. |
| B752 Carrier Admin | PASS local | Seeded synthetic carrier company settings, account/fleet/customer/asset workflows, permissions, independent tenant denial. Real carrier provisioning and self-service onboarding are not certified. |
| B753 Fleet Admin | PASS local | Native fleet-scoped navigation, own employment actions, membership/fleet hierarchy validation and denial outside assigned fleet. |
| B754 Driver | PASS local | Canonical identity, current active employment/fleet relationship, scoped operational actions; employment/binding revocation denies session. |
| B755 invitation lifecycle | PASS synthetic | Issue/setup, expiry, replay, concurrent redemption/refresh, password and Google binding, recovery and revocation. No live email or invitation. |
| B756 resilience | PASS local | Real disposable server restarts in durable-engine/management suites; encrypted state, idempotency and audit persistence; fault/rollback and stale-session denial. Durable browser also tests failed persistence and recovery. |
| B757 hosted matrix | BLOCKED | Exactly 84 hosted cases, each BLOCKED with prerequisites and blocker codes; 0 executed. No local result substituted for hosted status. |
| B758 accessibility | PASS automated / NOT RUN human | 121 general axe scans and 16 durable-mode scans, zero violations in each. 48 human cases remain NOT RUN. |
| B759 regression | PASS final | 869 repository tests, 60 general browser cases, 16 durable browser variants, 79 PostgreSQL leaf scenarios. Initial flaky audit assertion fixed and full repository gate rerun. |
| B760 evidence/commit | PASS local candidate | Exact file manifest and hashes in receipt; post-commit delivery/reproducibility checks in sidecar. All artifacts remain local. |

## Exact changes

- `scripts/certify-postgres17.mjs`: explicit local opt-in, version-17 binary guard, bounded dist output, seven sequential suites, fail-closed results and sanitized machine-readable report. No automatic download or connection to an existing database.
- `scripts/lib/isolated-postgres.mjs`: verify actual server major; expose version metadata; optionally skip Operations bootstrap so the staging sequence can be tested in order. Existing isolated TLS and cleanup boundaries retained.
- `tests/local/uat-staging-schema.postgres.mjs`: combined auth/broker/Operations sequence with the exact three runtime roles, isolation, idempotency, privilege denials and transaction rollback.
- `scripts/uat-handoff-preflight.mjs`: 13-name purpose/scope/validation contract and offline runtime compatibility checks; fixed error codes only; no pool/provider/network use.
- `tests/uat-handoff-preflight.test.mjs`: missing keys, Production/public-project rejection, origin/identity substitution, encryption and secret-key rejection tests.
- `tests/operations-intelligence.test.mjs`: remove flaky five-digit substring assertion; compare exact allowed audit metadata to persisted metadata and exclude a distinct private payload marker. A deterministic allowed UUID contains the cost digits, proving the old collision scenario.
- `docs/security/b741-b760-unified-certification.md` and `docs/security/b741-b760-receipt.json`: this report and machine-readable receipt.

Application runtime and UI source are unchanged from the starting commit. Existing branch suppression, opt-in hook and all authentication restrictions remain. The optional pre-push hook is not installed; no hook or Git configuration was modified.

## Counts and overlap policy

| Category | PASS | FAIL final | Skipped | Interpretation |
| --- | ---: | ---: | ---: | --- |
| npm run verify | 869 | 0 | 0 | One final full run; syntax/build/IP/structure gates also pass. |
| General Playwright | 60 | 0 | 0 | One complete fresh run; no reconciled rerun total. |
| PostgreSQL 17 | 79 leaf scenarios | 0 | 0 | Node reports 86 checks including 7 orchestration parents, excluded here. |
| Durable PostgreSQL 17 browser | 16 | 0 | 0 | Same 16 lifecycle case identities rerun in durable mode; not added to 60 unique browser cases. |
| Hosted E2E | 0 | 0 | 0 | 84 BLOCKED, none executed. |
| Human accessibility | 0 | 0 | 0 | 48 NOT RUN, none performed. |

Focused preflight (7), focused audit (12), the initial combined-schema development run and the initial repository run are retained as diagnostic evidence; not added to final counts. Initial repository run: 868 pass/1 fail. The only failure was the nondeterministic audit digit-substring check; the corrected assertion and full 869-test gate pass. No unresolved failure remains in these automated runs. No aggregate unique grand total is claimed across test layers or assertion families.

Each persona has four general authentication lifecycle cases (Google/password × 390/1440), two managed activation/recovery cases and four durable-mode lifecycle executions. The durable executions overlap the general case identities. All identities, provider responses and confidential delivery in these runs are synthetic.

Controls: 40/40 actions, 25/25 forms, 30/30 button labels and 18/18 navigation entries have explicit verified outcomes. Inventory contains 48 source route patterns, 76 fields (55 interacted) and 12 native dialogs. Source patterns are not a claim that all dynamic HTTP routes or all field permutations were exercised. Native cancellation/focus is automated where covered; human native-dialog/screen-reader behavior remains unverified. Passing axe does not establish full WCAG conformance.

## PostgreSQL 17 scope and reproducibility

Portable archive: [EDB PostgreSQL 17.11-5](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip).
Publisher [SHA-256 file](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256) and observed archive hash: `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
No service installation, global PATH change or privileged hosted connection occurred.

Run with explicit `IWAY_POSTGRES17_LOCAL_OPT_IN=true`, `IWAY_LOCAL_PG_BIN` pointing to verified PostgreSQL 17 binaries, and `node scripts/certify-postgres17.mjs dist/b741-b760`. Non-Windows machines also set `IWAY_LOCAL_OPENSSL`. Tests create their own random credentials and TLS CA, bind loopback port 5433, and remove their own temporary clusters.

Sequence: fixture-only minimal auth.users identity catalog and anon/authenticated NOLOGIN roles; B513 restricted auth role; historical B446 auth-membership contract; B512 v4 upgrade; B631 broker installation/verification; four checksum-tracked Operations migrations in `scripts/lib/operations-migrations.mjs`; B662 durable engine. The combined test applies exact SQL without role-name substitution. The existing engine/browser suites additionally exercise their explicitly named disposable iway_operations_fixture identity. Management runs its separately reviewed B710 schema and restricted management identity.

This verifies repository SQL on upstream PostgreSQL 17.11, matching the hosted major/minor observed read-only. It does not reproduce all managed Supabase extensions/configuration, a running GoTrue service, or the entire hosted schema. The historical B446 fixture is a controlled upgrade input, not an assertion that staging still has that historical schema. Hosted currently has B512 auth tables only; broker/Operations installation still requires catalog preflight and approval.

The broker's broad RLS policies intentionally cover control metadata for the approved roster; they are not business tenant policies. No business-table privileges are granted to the broker. Auth membership context and Operations tenant/principal policies enforce the tested business boundaries.

Rollback evidence covers failed transactions and preservation on safe reapplication. After a successful hosted activation, the proposed rollback is to disable activation, revoke sessions/handles and retain data/audit. No destructive down migration or production restoration was executed. Existing GitHub disposable DB job remains PostgreSQL 16; remote PostgreSQL 17 CI was NOT RUN, and the local version-pinned runner is supplied for a separately reviewed CI update.

Supabase compatibility notices were rechecked: [17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) and [HTTP TLS cipher retirement](https://supabase.com/changelog/cbc-tls-ciphers-deprecated). The reviewed application SQL does not use the affected legacy cipher/ltree/btree_gist/custom-estimator features; this source-review inference is separate from executed compatibility tests.

## Hosted configuration and approvals

Current team: eduradiusllc, Hobby. Public project: prj_0vutnbiNCYaxhdrbLfktrsHAvxty; staging: prj_7uof3CdmN1QvzKxETkXvHjlrLjVm. Both link olu3242/I-WAY with production branch main, rootDirectory null and no ignored-build command/hooks. Public Git creation enabled; staging currently disabled with repository dispatch disabled. Staging deployment protection remains all.

Prior Git Previews dpl_GgyCAntyykfmfdiXNcRFAr4Ux6vi and dpl_7TR9UuAcJ8Pc4R9CdEJZ4nay1Bio both build site/public. They cannot certify this application's hosted readiness. Local branch suppression was added in B701; [Vercel rules](https://vercel.com/docs/project-configuration/git-configuration) explain that unspecified branches remain enabled and any matching true rule wins. It has not been exercised by a new push. Connector event inspection returned 403; the same scoped authenticated CLI GET succeeded. The saved last-100 event metadata contains no credential values and does not establish historical setting transitions.

All 13 application keys are absent from staging Preview. Ten legacy names are Production-only. Do not copy their values into Preview, repurpose legacy DATABASE_URL, or fake VERCEL_ENV. The names-only matrix gives exact scope and rules. Google callback is https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback; the application's exact owner-approved Preview origin plus /auth/callback has not been assigned or approved. Private Google/Supabase signup, linking, redirect and provider settings remain unverified.

Fresh catalog observation: PostgreSQL 17.11; zero Auth users, Google identities, active memberships and verified MFA factors. Only iway_auth_runtime and iway_private exist among required runtime roles/schemas. Catalog inspection is not a successful restricted-runtime login. Fresh private credentials, broker/Operations roles and schemas, tenant/fleet/employment IDs, canonical UUID/subject mappings and approved permission sets remain prerequisites. No actual IDs or privileges were invented. The existing four-email manifest is preserved unchanged.

Minimum protected access design: use individually approved external collaborators on the exact commit-specific protected Preview; each tester uses their own Vercel account, then I-WAY authentication and authorization. [Vercel sharing guidance](https://vercel.com/docs/deployments/sharing-deployments) permits one active external collaborator on Hobby. Four testers can run sequentially only after approved grant/revoke operations and denial verification. Concurrent access requires separately approved Pro billing; [current Pro pricing](https://vercel.com/docs/plans/pro-plan) starts at USD20/month plus applicable usage/tax. External collaboration does not require four deploying seats. No team memberships or bypass links are proposed.

`dist/b741-b760/deployment-isolation-report.json` records seven exact-target approval proposals, each with risk, verification and rollback: push; restricted credentials/schemas; Preview environment/origin; roster/hierarchy/MFA provisioning; separate management activation; exact-artifact protected Preview deployment; individual tester grants and hosted testing. None is authorized by this certification.

## Outstanding gates and decisions

- **Local covered workflows GO**: all final automated checks pass on the reviewed candidate; no critical dead controls or tenant violation found within tested scope.
- **Protected Preview NO-GO**: fresh credentials, exact origin/private provider settings, schemas/roles, bindings, management activation and deployment approval missing; isolated artifact not deployed.
- **External UAT NO-GO**: above prerequisites plus individual protected access, real identities/MFA/hierarchy and all 84 hosted cases; 48 human AT cases remain NOT RUN.
- **Production NO-GO**: no production activation approval or certification; Preview-only runtime restriction retained.

Evidence is local in `dist/b741-b760`; tracked receipt hashes bind the completed test/inspection inputs. Post-commit evidence binds the exact ending SHA, immutable package, reproducibility and clean Git state. Secret review checks configured private values/decoded DB password and selected secret formats; no matches, .env.local ignored/untracked. This is a bounded scan, not a universal guarantee. The .env.local file was never printed, copied into delivery, uploaded or committed.
