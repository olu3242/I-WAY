# I-WAY B681–B700 hosted-readiness certification

Local covered workflows: **GO**. Protected Preview: **NO-GO**. External hosted UAT: **NO-GO**. Production: **NO-GO**.

This review began from clean branch `work/b561-b580-external-uat` at `928dfc7a9af8e09ddd794d61bce403fe47ec2390`. The readiness revision is the Git commit containing this report and its receipt; the generated delivery manifest records that revision literally after commit. No push, merge, deployment, credential rotation, schema change, account provisioning, invitation, billing change, or deployment-protection change was performed.

## Independently verified baseline

The B661–B680 receipt, report, artifact manifest and 84-case matrix were read and checked against local bytes and Git objects before reuse. All 38 recorded source hashes, 17 evidence hashes, 81 packaged source Git blobs and 86 extracted artifact files matched. A fresh build from the exact clean baseline commit reproduced the same archive SHA-256:

`e7cee3eaafce3b9668a1b4e6d658dc40bf460b5d97c3d2aebd169a5ea43d4f37`

The baseline ZIP and its evidence remain intact under `dist/b661-b680/`. Detailed independent results are `dist/b681-b700/baseline-integrity.json` and `baseline-delivery-verification.json`. A local artifact verification result of `APPROVAL_REQUIRED` is a delivery plan, not permission to deploy.

The previously reported 977 is a sum of suite-reported executions. It is **not 977 distinct tests**: the worker check repeats a browser scenario, and PostgreSQL totals include parent tests and subtests. The focused authentication run below also overlaps the full repository run and must not be added to it.

## Batch 1 — B681–B690

| Batch | Inspection or remediation | Result |
| --- | --- | --- |
| B681 | Verify branch, exact baseline and preservation | PASS — clean starting tree; existing implementation preserved |
| B682 | Check receipt, report, manifest, matrix and Git provenance | PASS — all recorded hashes match |
| B683 | Reproduce and verify isolated artifact | PASS — identical ZIP; no deployment |
| B684 | Compare all required environment names by target | PASS inspection; readiness BLOCKED — 13/13 Preview keys missing |
| B685 | Review credential dependencies | BLOCKED activation — fresh restricted credentials and session key required; no private values transmitted |
| B686 | Inspect hosted roles, grants, RLS and actual-login requirements | PASS catalog inspection; three actual runtime logins BLOCKED |
| B687 | Compare schema and PostgreSQL versions | BLOCKED hosted integration — broker/engine schemas absent; PostgreSQL 17 parity NOT RUN |
| B688 | Check public signing keys and private Google/MFA prerequisites | PASS public ES256 key loading; real OAuth/MFA and callback settings BLOCKED |
| B689 | Reconcile four-persona identities and relationships | BLOCKED provisioning — zero Auth users/memberships; actual IDs remain null |
| B690 | Fix safe local preflight defects and regress | PASS — Operations key required; blank credentials rejected; full regression passes |

Fresh hosted observations were recorded at `2026-10-24T00:14:44.350Z` (October 23 in America/Chicago). The sanitized snapshot is `dist/b681-b700/hosted-readonly-inspection.json`; no secret values were pulled, decrypted, or written into it.

### Git and deployment triggers

Both Vercel projects link to `olu3242/I-WAY` with production branch `main`. Public project `i-way` has Git deployments enabled; the isolated staging project has Git deployments disabled and repository-dispatch deployments disabled. Both have no ignored-build command and no deployment hooks. Therefore a feature-branch push can still trigger a public-project Preview. **Do not push** without explicit trigger-aware approval. Local commits do not push.

The current branch runs GitHub `Verify` and `Identity access certification` on push/PR. Their inspected jobs run checks and disposable tests; they do not deploy. The older branch-filtered identity workflows do not match this feature-branch push. Vercel's independent public-project Git integration remains the deployment risk.

Staging protection is still enabled for all deployments. The only listed staging deployment is `dpl_APs1ZkJVQfADo9H8Vq6wxDFBfPNc`, READY, **Production target**, from `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`. The certified candidate has no hosted Preview. Keep the runtime's genuine Preview/project/origin gates; do not make the old Production-target deployment pass by overriding platform environment variables.

### Environment configuration matrix

All required names below are absent from Preview. Staging has ten existing Production-scoped names; their values were neither decrypted nor compared. Local `.env.local` has only two nonblank names from this contract and is not ready for this candidate. Presence never certifies validity or identity.

| Required name | Intended configuration |
| --- | --- |
| `IWAY_AUTH_ENABLED` | Explicit owner-approved authentication activation |
| `IWAY_AUTH_SCHEMA_APPROVED` | Exact reviewed authentication schema gate |
| `IWAY_STAGING_VERCEL_PROJECT_ID` | Exact isolated staging project pin |
| `IWAY_AUTH_ORIGIN` | Exact approved HTTPS Preview origin |
| `IWAY_AUTH_APPROVED_ORIGIN` | Independent match to that approved origin |
| `IWAY_AUTH_DATABASE_URL` | Fresh TLS connection as `iway_auth_runtime` |
| `IWAY_AUTH_PROVIDER` | Google provider selection |
| `IWAY_SUPABASE_PUBLISHABLE_KEY` | Current publishable key; no service-role runtime key |
| `IWAY_SESSION_ENCRYPTION_KEY` | Fresh key in the candidate's supported encoding |
| `IWAY_UAT_ENABLED` | Explicit owner-approved dual-auth activation |
| `IWAY_UAT_SCHEMA_APPROVED` | Exact reviewed broker schema gate |
| `IWAY_UAT_DATABASE_URL` | Fresh TLS connection as `iway_uat_runtime` |
| `IWAY_OPERATIONS_DATABASE_URL` | Fresh TLS connection as `iway_operations_runtime` |

`VERCEL_ENV` and `VERCEL_PROJECT_ID` must come from genuine platform Preview execution. Do not copy the public site's old database identity, service role, OpenAI key, or native OAuth secret into the UAT runtime. Previously disclosed private credentials require owner-controlled replacement before activation; no rotation was attempted. The names-only comparison is `dist/b681-b700/environment-contract.json`.

### PostgreSQL and identity evidence

The pinned Supabase project reports PostgreSQL **17.11**. Only `iway_auth_runtime` exists among the three required runtime roles: LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and NOREPLICATION. It has no role memberships, owns no relations, and lacks database/schema CREATE. Its nine table grants are SELECT/INSERT/UPDATE on PKCE and server sessions, and SELECT on tenant roles, tenants and resources. All five authentication tables have RLS and FORCE RLS. The unrelated early-access table has RLS but not FORCE RLS and is outside this auth contract. The security advisor returned zero findings; that does not certify security.

`iway_uat_runtime`, `iway_operations_runtime`, and their broker/engine schemas are absent. Owner application of reviewed schemas and fresh restricted logins remain prerequisites. These were administrative **catalog reads**, with no role impersonation. Actual `session_user`, `current_user`, TLS, grants and cross-tenant denial through each configured restricted login remain **BLOCKED**. The local baseline used PostgreSQL 18; this batch did not run a PostgreSQL 17 compatibility fixture. Do not infer hosted identity or version parity from the baseline.

There are zero Auth users, Google identities, active memberships, auth tenants, auth resources and MFA factors. No actual carrier, fleet, driver, governance or principal IDs were manufactured. The approved roster remains an allowlist only; the detailed prerequisites are in `b691-b695-provisioning-readiness.json`.

### Google, password and MFA configuration

The pinned project's public JWKS endpoint returned one ES256 public key, and the candidate's actual public-key loader accepted it. No private key fields were present. This resolves the public-signing-key availability question only; no real JWT, Google login or MFA completion was certified.

The Google provider callback must be `https://vnoxdinldneeczxibicp.supabase.co/auth/v1/callback`; Supabase must allow the exact approved Preview origin plus `/auth/callback`. No stable approved Preview origin exists yet. Google Console/Supabase private redirect settings, signup policy and account-linking configuration were not accessible through the available read-only tools and require owner verification. No old authentication-settings snapshot is presented as current evidence.

Google and password login must resolve to the same approved canonical UUID and explicit verified Google subject, native principal, permissions and relationships. Email-only linking is rejected. Platform and Carrier require AAL2 with an existing verified TOTP factor. The current provider adapter challenges existing factors; it does not enroll MFA. Human activation/enrollment is a separate reviewed prerequisite.

## Batch 2 — B691–B700

| Batch | Preparation or verification | Result |
| --- | --- | --- |
| B691 | Prepare approved roster and missing-record manifest | PASS preparation; actual provisioning BLOCKED |
| B692 | Inspect invitation issuer and delivery path | BLOCKED_ENGINEERING — hosted adapters deliberately deny issuance/delivery |
| B693 | Exercise all four synthetic activation/provider mappings | PASS — four new persona tests; no real accounts |
| B694 | Check invitation/MFA lifecycle and role isolation | PASS local focused regression; real enrollment and assignments BLOCKED |
| B695 | Check recovery, membership removal and revocation | PASS local synthetic regression; no live delivery |
| B696 | Inspect individually authorized external access | PASS design; access grants and any billing change BLOCKED pending approval |
| B697 | Reconcile exact Preview and immutable delivery prerequisites | PASS local preparation; hosted activation BLOCKED |
| B698 | Execute authorized read-only hosted checks | PASS catalog, environment-name and public-JWKS inspections only |
| B699 | Reconcile hosted and human accessibility matrices | 84 hosted cases BLOCKED; 48 human cases NOT RUN |
| B700 | Run regression, scan candidate and commit local evidence | PASS local validation; hosted decisions remain NO-GO |

### Provisioning and external-access design

The JSON checklist preserves all four approved emails, null actual identifiers, no assigned permissions and no provisioning approval. Platform remains in its governance control plane with no carrier/fleet membership. Carrier, Fleet and Driver require one recorded synthetic carrier hierarchy, with an actual fleet and active Driver employment relationship. Never derive memberships from successful Google authentication.

Invitation readiness requires additional engineering: the hosted runtime deliberately injects denied administrator authentication, issuance and delivery adapters. A separate reviewed management-plane issuer and confidential fixed-origin delivery channel must be implemented, tested and authorized. Merely configuring secrets or enabling Supabase email login will not activate issuance. Existing setup/recovery consumption is implemented. Default invitation lifetime is one hour, allowed range 60 seconds to 24 hours, single use; password setup requires 15–128 characters and creates no application session. The next login is required, with privileged MFA. Recovery and revocation invalidate prior sessions. Rate limits, audit and failure fencing remain in place.

Use individually invited external collaborators on the immutable commit-specific Preview, retaining Vercel authentication. Protected collaborators need their own Vercel accounts but are not added to the team. Current Hobby permits **one collaborator at a time**; sequential testing requires explicit access-grant/revocation approval. Four simultaneous external collaborators require Pro or Enterprise. No share or bypass token was created. [Vercel sharing documentation](https://vercel.com/docs/deployments/sharing-deployments)

The currently documented Pro platform fee is USD $20/month including one deploying seat, plus applicable usage and taxes. External testers do not require deploying team seats under this design. Any paid-plan change requires separate billing approval; no upgrade was initiated. [Vercel Pro pricing](https://vercel.com/docs/plans/pro-plan)

### Test evidence and remaining execution

| Suite | Result | Evidence scope |
| --- | --- | --- |
| Repository `npm run verify` | **846 PASS, 0 FAIL, 0 skipped** | Fresh run; source check, site build, IP scan and site check also passed |
| Focused authentication/preflight | **53 PASS, 0 FAIL, 0 skipped** | Fresh run; included in the 846, not additive |
| Browser full | 52 PASS, 0 FAIL | Baseline logs independently hash-verified; not rerun |
| Browser with durable PostgreSQL | 16 PASS, 0 FAIL | Baseline; synthetic identity provider; not rerun |
| Targeted worker browser | 1 PASS, 0 FAIL | Baseline repeated scenario; not a distinct coverage total |
| PostgreSQL suites | 68 PASS, 0 FAIL | Baseline parent/subtest counts; not rerun |
| axe | 105 recorded scans, 0 violations | Baseline; no complete WCAG claim |
| Hosted authentication/workflows | **84 BLOCKED, 0 executed** | Reconciled exact matrix; no hosted certification |
| Human accessibility | **48 NOT RUN** | Four-persona keyboard/screen-reader/native-dialog/mobile checklist retained |

The full regression includes six new tests: two for missing Operations/blank database credentials, and four for synthetic setup, both authentication methods, canonical mapping, recovery, membership removal and revocation. Existing focused tests cover invalid/unapproved identities, expired/reused invitations, MFA, CSRF, refresh, logout, replay and tenant-boundary denial. No application authorization or durable persistence code was changed in this batch.

Once all prerequisite gates pass, execute every retained hosted case using approved testers and synthetic records, including fifth-user rejection, wrong-role/tenant/fleet/resource access, callback/state replay, refresh races, expiry, logout, recovery, MFA and revocation. Capture sanitized actor references and results only; never raw tokens, passwords, secret env values, proof links or sensitive screenshots. Human reviewers must record OS/browser/assistive-technology versions, keyboard/focus behavior and actual observations. Native-dialog and screen-reader certification remains NOT RUN.

## Minimum authorization and blockers

Owner approval must identify the isolated project, exact immutable artifact/commit, schema changes and three restricted credential identities, four canonical users and approved permission subsets, actual synthetic hierarchy records, MFA enrollment, exact redirect settings, and the separate invitation issuance/delivery design. Approve individual external collaborator grants separately; choose sequential Hobby access or explicitly approve paid billing for concurrent access. No approval to merge, modify production or disable SSO is implied.

Before such approval can produce a runnable hosted candidate, finish the missing management-plane adapters and their review, supply fresh credentials/13 Preview keys, apply approved schemas and real bindings, verify actual restricted sessions and PostgreSQL 17 compatibility, establish verified MFA factors and provider callback policy, and prepare the genuine protected Preview. Then execute the 84 hosted and 48 human cases. Successful local synthetic tests and public key discovery do not remove those gates.

The final pre-commit secret review scanned 788 tracked/candidate regular files: zero configured private credential matches and zero selected private-secret-format matches. The baseline ZIP also contained zero configured private credential matches. `.env.local` remains ignored and untracked. This scoped scan does not certify owner credential rotation or absence of every possible secret.

Machine-readable receipt: `b681-b700-receipt.json`. Local evidence: `dist/b681-b700/`. The final readiness commit and any newly packaged ZIP checksum are recorded in the post-commit delivery manifest and final response. Deployment, external-user activation and production remain **NO-GO**.
