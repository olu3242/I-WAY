# B531–B540 runtime security remediation

Baseline: 22b8b35aa0832c74b65a9228902f01586b8df750. Branch: work/b391-b398-hosted-identity-certification. Environment: Supabase vnoxdinldneeczxibicp, Vercel prj_7uof3CdmN1QvzKxETkXvHjlrLjVm / team_zNHlJbJHa4YZFwN4p9lcHzEH. No production or public-site changes. Release: **NO-GO for hosted certification**.

## B531 — membership forensics

Live history reconfirms migrations 20261021222437 and 20261021222452. The only incident membership is role iway_auth_runtime → member postgres, granted by supabase_admin (bootstrap OID10), ADMIN=true, INHERIT=false, SET=false. Runtime is not a member of another role and has no path to postgres, supabase_admin, pg_read_all_stats, pg_read_all_data or pg_monitor. No inheritance, superuser, BYPASSRLS, CREATEROLE, CREATEDB or replication attribute is present. It owns no relations or schemas and has no writable non-temporary schema. USAGE exists on public and iway_private; not extensions, auth, storage or other application schemas.

Classification: legitimate PostgreSQL creator administration, not runtime privilege escalation. PostgreSQL automatically grants the created role to a non-superuser CREATEROLE creator with exactly these options. The administrator can manage the created role; ADMIN is not an inheritance path in the opposite direction. It remains a trusted database administrator capable of granting privileges later; the checker is not protection against an administrator deliberately changing policy.

The checker previously rejected all inbound memberships. It now accepts only the observed postgres administrator edge with CREATEROLE, a superuser bootstrap grantor OID10, ADMIN=true and both SET/INHERIT=false. Every runtime outbound membership and every other inbound membership still fails. No role memberships were revoked or granted in staging.

Source: [PostgreSQL 17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html). The live result supports this classification independently of the role name alone.

## B532 — statistics-view investigation

| View | Owner/extension | Definition and dependencies | Exposure and action |
| --- | --- | --- | --- |
| extensions.pg_stat_statements | postgres; pg_stat_statements 1.11 | Projection of C function pg_stat_statements(true); no base-table dependency | PUBLIC SELECT is latent: runtime lacks extensions USAGE. No direct runtime access. Preserve grant. |
| extensions.pg_stat_statements_info | postgres; same extension | dealloc and stats_reset from C function pg_stat_statements_info(); no base-table dependency | Same schema denial; counters/reset timestamp rather than tenant records. Preserve grant. |

Both views have default view options (not security_invoker=true). Their dependencies are the extension functions, not tenant tables. Functions are C language, SECURITY INVOKER (prosecdef=false), from $libdir/pg_stat_statements; PUBLIC EXECUTE is likewise blocked by absent schema USAGE. Extension membership, definitions, ACLs and function metadata are captured in b531-live-evidence.json. No statistics rows/query text were read.

PostgreSQL documents these as extension statistics views. Non-superusers without pg_read_all_stats cannot see another user's query text/queryid, although statistics can be visible when access is granted. Own query text may still be sensitive. Therefore this report does not call the views universally harmless or approve schema access. The live runtime lacks both schema USAGE and statistics-role membership. The deployment history that originally created the PUBLIC grant is not independently proven; current extension provenance and documented defaults are established.

The checker now evaluates table/column ACLs together with schema USAGE, without a name-based statistics-view allowlist. A later USAGE grant makes these unrelated relations fail readiness. A public view wrapping a blocked-schema relation also fails. Live metadata found zero reachable unrelated relations, zero reachable non-system SECURITY DEFINER functions and zero writable schemas. This is catalog evidence, not a genuine login test.

Sources: [PostgreSQL schemas and privileges](https://www.postgresql.org/docs/17/ddl-schemas.html), [pg_stat_statements security](https://www.postgresql.org/docs/17/pgstatstatements.html). Cached prepared statements and administrator changes remain reasons to use fresh pools and rerun checks after any privilege change; no earlier runtime login has been provisioned here.

## B533–B534 — minimal remediation and rollback

Repository-only checker correction; **no database privilege patch is justified by these two findings**. The review SQL db/review-only/iway_auth_runtime_review_b533.sql is explicitly READ ONLY, has no DDL/GRANT/REVOKE, and passed against staging. It asserts restricted attributes, the narrow creator-edge rule, no schema DDL, and no reachable unrelated table/column privileges. Existing RLS, authorization predicates and grants remain unchanged. The checker additionally requires both current_user and session_user to be iway_auth_runtime; an administrative connection using SET ROLE cannot pass. Schema CREATE/ownership checks now cover all persistent schemas.

Regression tests use a real disposable TLS PostgreSQL login: permitted creator edge; denied SET/INHERIT changes; denied outbound and untrusted inbound membership; schema-denied view SELECT returns42501; adding USAGE or an accessible public wrapper fails readiness; real current_user/session_user; existing RLS/tenant isolation and encrypted lifecycle. An initial test tried a cyclic membership PostgreSQL itself disallows; its setup was corrected to revoke the inverse edge first. A unit stub lacked the newly required login field; it was corrected, and a separate negative administrative-login test added. Final results: repository766/0/0; PostgreSQL18/0/0 (passed/failed/skipped). Neither initial failure was suppressed.

Rollback: revert the checker commit in the repository and rebuild; the previous checker will deny this platform configuration. Keep authentication disabled. No database rollback, grant reversal, or destructive down migration is needed because B531–B534 performed no database writes. B534 exact-change approval is not requested for a no-op. B513 remains an immutable historical role script; its generic existing-role rejection must not be mistaken for this new platform-aware review.

## B535–B540 — remaining execution gates

B535 is blocked by the absent approved credential workflow. The staging role was created PASSWORD NULL. No genuine runtime connection was attempted; no admin SET ROLE is counted as login evidence. The user supplied the proposed callback only, not credentials, a secret-manager workflow, an OAuth provider, or a synthetic-account owner. Never paste secrets into chat or reports.

B536 requires that runtime login plus approved synthetic provider users before mutating hosted PKCE/session fixtures. Existing local lifecycle tests cover one-time consumption, expiry, encryption, revocation, refresh claims, concurrency and recovery; they are not hosted acceptance.

B537 metadata rechecked: exact project/team, Node24, SSO protection on all deployments, no deployments. Only IWAY_AUTH_ENABLED, IWAY_STAGING_VERCEL_PROJECT_ID and IWAY_AUTH_ORIGIN exist as preview variable names. Missing: IWAY_AUTH_DATABASE_URL, IWAY_SESSION_ENCRYPTION_KEY, IWAY_SUPABASE_PUBLISHABLE_KEY, IWAY_AUTH_PROVIDER, IWAY_AUTH_SCHEMA_APPROVED, IWAY_AUTH_APPROVED_ORIGIN. Values were not decrypted, retrieved or displayed. Database target cannot be verified from an absent URL. No authentication flag changed.

B538 callback remains https://iway-auth-staging.vercel.app/auth/callback, expressly pending real deployment routing and provider registration. No provider was inferred or configured, no synthetic identities provisioned, no real testers invited.

B539 protected deployment and actual-provider E2E are NOT RUN because B535–B538 prerequisites are absent. Deployment ID/URL: none. B540 hosted outage, recovery, load, rollback and post-rollback tests are NOT RUN; there is no known-good hosted rollback candidate. Local tests and a successful build do not satisfy those gates.

## Batch outcomes

All batches use the source/evidence commit listed in the final receipt/Git history; CI results are bound to that exact commit. No new database migrations in this cycle. Security advisory read returned an empty lint list, which is not a substitute for runtime certification.

| Batch | Implementation / database evidence | Tests | Blocker / release |
| --- | --- | --- | --- |
| B531 | Membership graph, grantor, options, schema/default ACLs and ownership inspected | Live metadata + local membership regressions | Forensic classification complete; NO-GO overall |
| B532 | View/function definitions, dependencies and effective access inspected | Live metadata + real schema-denial and wrapper tests | No confirmed direct exposure; NO-GO overall |
| B533 | Checker corrected; read-only review SQL and rollback documented | Repository766/0/0, isolated PostgreSQL18/0/0 | Repository remediation complete; hosted login pending |
| B534 | No confirmed privilege violation requiring database changes | Live read-only review PASS | No migration necessary for these findings |
| B535 | Actual-login requirement enforced | Administrative-login negative unit test | BLOCKED: secure runtime credential workflow |
| B536 | Existing persistence implementation retained | Local lifecycle passes | BLOCKED: actual restricted login and approved identities |
| B537 | Names-only Vercel readiness inspected | Metadata only | BLOCKED: six required variable names absent |
| B538 | Proposed callback retained | No real provider test | BLOCKED: provider/identity setup and actual routing |
| B539 | Existing deployment/E2E tools retained | NOT RUN hosted | BLOCKED: prerequisite gates |
| B540 | Evidence and recovery limitations recorded | NOT RUN hosted recovery/rollback | NO-GO |

Modified paths: server/operations-auth-database-check.mjs; tests/local/operations-auth-postgres.test.mjs; tests/operations-auth-runtime.test.mjs; db/review-only/iway_auth_runtime_review_b533.sql; docs/security/b531-live-evidence.json; this report; final receipt if present. Source gate and CI outcomes are recorded with the final evidence. No public-site changes or merge.
