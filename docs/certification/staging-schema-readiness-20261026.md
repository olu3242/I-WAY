# Staging schema readiness — 2026-10-26 UTC

Scope: Supabase vnoxdinldneeczxibicp and protected iway-auth-staging Preview only. No production application deployment or activation.

## Applied migrations

The broker installer and durable operations installer now recognize the exact managed bootstrap grant already accepted by authentication: administrator postgres with CREATEROLE, superuser grantor OID 10, ADMIN true, INHERIT false, SET false. All outbound memberships and every other inbound membership remain rejected. No role grants or passwords were changed.

Applied after successful transaction rollback rehearsals:

- iway_uat_broker_managed_role_compatibility
- iway_operations_ordered_1_with_checksum
- iway_operations_ordered_2_with_checksum
- iway_operations_ordered_3_with_checksum
- iway_operations_ordered_4_with_checksum
- iway_durable_engine_managed_role

Original ordered migration checksums were preserved in operations_migrations.applied:

| Migration | SHA-256 |
| --- | --- |
| 20261011174100_operations_persistence_readiness.sql | 0f2bf75c58ab0af6cc7a245f092e29da2943a8316611e8aa85deb699d3436c81 |
| 20261011210552_operations_active_principal_rls.sql | 0e18a93c613a977010bfaa481318033087a9687b2c086f7d5fe66746f9dc2ef9 |
| 20261011220000_operations_actor_evidence.sql | 96969f98e7af15b7ba26527ab92764642e7eb8ebe2711921fe321a4b2ca8527e |
| 20261011221000_operations_dispatcher_directory.sql | 0a8b2ba5dddc1c8dd438797c3ef57e16a1eedce5515f8241e0ec01bc4236de5b |

## Observed live verification

Protected diagnostic deployment dpl_DfnaneH6KoVWoeCo16uDQDWqQH5F ran scripts/staging-schema-probe.mjs using actual Preview credentials and explicit read-only transactions. Authentication, UAT and Operations each returned PASS_RUNTIME_SCHEMA_READINESS; aggregate PASS_SCHEMA_READINESS_ONLY. The probe invokes the runtime readiness implementations directly, does not use SET ROLE, and reports no credentials.

- iway_uat_private: 6 tables, all forced RLS.
- operations_private: 7 tables, all forced RLS.
- operations_engine_private: 5 tables, all forced RLS.
- Detailed B631 verifier passed in a read-only transaction.
- Eight synthetic membership cases passed in a read-only SQL matrix.
- Supabase security advisor returned no findings at verification time.
- Earlier connection deployment dpl_ERKnnCnRssWyoWNGHfSqe3584vQc passed genuine role identity, restricted flags and TLS checks for all three connections.

## Boundaries

This is schema readiness, not hosted certification. No tenant workflow was run. No identities, invitations, tenant bindings or MFA records were seeded. IWAY_AUTH_ENABLED and IWAY_UAT_ENABLED remain absent. Existing early-access data was not modified. Full hosted identity and tenant workflow verification remains outstanding.
