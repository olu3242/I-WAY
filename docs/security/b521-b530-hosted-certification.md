# B521–B530 hosted certification remediation

Baseline: 29bc31cabaaaa06c3f51dafe2a82e9820252cb1d on work/b391-b398-hosted-identity-certification. Inspection date: 2026-10-21. Decision: NO-GO; hosted certification incomplete. No application code changed.

## Verified access and minimum permission

The previously used CLI account lists four unrelated projects and not vnoxdinldneeczxibicp. The new OLU Supabase connection lists precisely the requested project, organization wqbsdubhsbhpytpgkuna, region us-west-2, ACTIVE_HEALTHY, PostgreSQL 17.11. A BEGIN READ ONLY catalog query through OLU succeeded as postgres. This resolves the catalog-access blocker without changing permissions. It does not certify the runtime identity.

The historical failure was HTTP403 on `supabase db query --linked --project-ref vnoxdinldneeczxibicp --file db/review-only/iway_auth_catalog_b498.sql --output json`. This cycle's initial repeat did not execute because automatic approval review hit a usage limit. Therefore no fresh CLI403 is claimed. The evidence bounds the historical cause to CLI account/project authorization or token scope; it does not distinguish membership from token restrictions. It is not evidence of a PostgreSQL grant failure.

Administrator remediation: use the already-authorized OLU connection for this project. If CLI access is needed, verify the intended account and project membership in the dashboard and authorize a project-scoped credential through the approved login workflow; never paste tokens into chat. The dedicated read-only query endpoint requires `database:read` OAuth scope or `database_read` fine-grained permission. Do not grant owner, BYPASSRLS or runtime DDL rights to solve catalog access. Sources: https://supabase.com/docs/reference/api/v1-read-only-query and https://supabase.com/docs/guides/platform/personal-access-tokens .

## Live compatibility and approval package

Raw metadata-only responses are retained in b521-live-inspection.json. No customer, auth-user, session or token rows were queried.

| Object | Live observation | Reviewed B512 effect |
| --- | --- | --- |
| auth_tenant_roles columns | user_id UUID, tenant_id UUID, role text, granted_at timestamptz default now(), revoked_at nullable timestamptz | Preserve; add active=false, permissions={}, nullable principal_id/fleet_id |
| Primary key | (user_id, tenant_id, role) | Preserve |
| User foreign key | Validated auth.users(id), ON DELETE CASCADE | Preserve existing semantics and object |
| Role check | carrier, fleet, platform, driver | Preserve |
| RLS | Enabled and forced; no policies | Add scoped runtime SELECT policy |
| ACL | postgres only on role table | Add runtime SELECT; no provisioning rights |
| Triggers/dependencies | No custom triggers; only type, toast, constraints and granted_at default dependencies | No dependency replacement |
| Runtime role | Absent | B513 creates restricted LOGIN with PASSWORD NULL |
| Session/PKCE/tenant/resource tables | Absent | Create with restricted grants, constraints and forced RLS |
| early_access_leads | Existing registration INSERT grant/policy; RLS enabled | Outside migration table list; registration schema USAGE preserved |
| Public schema | PUBLIC has USAGE, not CREATE | No public DDL grant |

Role table size: 16,384 bytes. Migration history versions: 20261011055816, 20261011062148, 20261020224135. These are existing identifiers, not new migration receipts.

The exact read-only B512 preflight ran against staging. All preceding shape checks completed; final role prerequisite raised P0001: `Dedicated restricted iway_auth_runtime role must be provisioned first`. Full preflight is NOT PASS until that role exists. Isolated PostgreSQL tests reran: 16 passed, 0 failed, 0 skipped. The first sandboxed attempt failed before fixture setup; the authorized isolated run passed. These remain local tests, not hosted runtime tests.

Administrative approval requested for these exact existing files, in this order, on vnoxdinldneeczxibicp only:

1. db/review-only/iway_auth_role_b513.sql — SHA256 cc1590f0eae671cbf0b83465b491144341b41f28f292c47613ca2612098f133a.
2. Rerun db/review-only/iway_auth_preflight_b512.sql; stop on any error.
3. db/review-only/iway_private_auth_sessions_b512.sql — SHA256 8747c83a473133a949faa3e056f30b67628498da7aa1ab3ee6e82ddba3a403eb.
4. Run postflight and compare constraints, policies, grants and registration-table metadata. Record new migration identifiers. Restricted-login tests require separate secure credential provisioning.

B513 does not create a usable password or activate any identity. B512 adds deny-default authorization columns and four private tables. It preserves existing role records, primary key, role check and CASCADE foreign key. No existing session table was found; its legacy-token erasure clause therefore has no existing session rows to affect in the observed schema. Reinspect before execution if state changes. B524 explicitly requires administrative approval; no SQL writes have run.

Recovery: each script is transactional with bounded timeouts; errors roll back that script. If role creation succeeds and schema migration fails, the passwordless role remains without application table grants. Stop and review; do not hard-delete. After committed schema changes, keep authentication disabled and forward-fix reviewed SQL. Never restore erased tokens or run destructive down migrations. No known-good deployed rollback candidate exists.

## B525–B530 independent findings

Vercel project prj_7uof3CdmN1QvzKxETkXvHjlrLjVm belongs to team_zNHlJbJHa4YZFwN4p9lcHzEH; Node24, SSO protection for all deployments. Domain iway-auth-staging.vercel.app is verified and assigned. Deployment count is zero. Domain assignment does not establish working routes.

Names-only, decrypt=false inspection finds three preview variables: IWAY_AUTH_ENABLED, IWAY_STAGING_VERCEL_PROJECT_ID, IWAY_AUTH_ORIGIN. Missing: IWAY_AUTH_DATABASE_URL, IWAY_SESSION_ENCRYPTION_KEY, IWAY_SUPABASE_PUBLISHABLE_KEY, IWAY_AUTH_PROVIDER, IWAY_AUTH_SCHEMA_APPROVED, IWAY_AUTH_APPROVED_ORIGIN. Secret contents were not retrieved or displayed. Readiness is BLOCKED. Restricted database credentials and a distinct staging encryption key must be provisioned in the service secret manager; no production/public-site reuse.

Candidate callback from existing runtime: https://iway-auth-staging.vercel.app/auth/callback. This is not a verified live callback. Provider selection/registration and synthetic identities remain unapproved and unprovisioned. No real testers or customer records used.

| Batch | Result / next prerequisite |
| --- | --- |
| B521 | Catalog access restored through authorized OLU connection; historical CLI denial bounded |
| B522 | Live catalog compared; no shape mismatch before absent-role prerequisite; administrative compatibility approval pending |
| B523 | BLOCKED: runtime role and credential absent; no actual restricted-login result |
| B524 | BLOCKED: exact-script administrative approval required |
| B525 | Inspected; six required names absent; readiness fails |
| B526 | Verified domain assignment only; provider callback/routing NOT TESTED |
| B527 | Synthetic accounts/tenant mappings NOT PROVISIONED |
| B528 | NOT DEPLOYED; no deployment ID or URL evidence |
| B529 | Hosted lifecycle/isolation NOT RUN |
| B530 | Hosted outages, recovery, workload and rollback NOT RUN; NO-GO |

Modified files: this report and b521-live-inspection.json only. Baseline CI passed all four workflows as recorded in B520; fresh documentation commit CI must be checked separately. Production, merge and real-tester onboarding remain unauthorized. The next concrete approval is the staged B513/B512 package above; it does not authorize secrets, provider configuration, accounts or deployment by implication.
