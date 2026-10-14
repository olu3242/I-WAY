# QA Persona Persistence Integration (Batch 3)

This is a **review-only SQL schema**, not an applied migration. The connected Supabase projects have not been verified as I-WAY. Apply only after project authorization and migration naming through the CLI.

## Required backend wiring
- Verify bearer token server-side; resolve actor and target memberships from trusted storage.
- Restrict issuance to platform_admin with explicit QA switch entitlement.
- Wrap session insert and append-only start audit in **one database transaction**; fail closed if audit insert fails.
- Wrap session revocation and stop audit in **one transaction**, with conditional update and idempotent handling.
- Read sessions only through trusted backend code, never from a public API.
- Validate target membership on every effective request, including after revocation.
- Propagate original and effective actor IDs to operational audit; never replace the original actor.
- Explicitly disable QA switching in production and require QA_PERSONA_ENABLED=true in nonproduction.
- Reconcile PostgreSQL UUID principal IDs versus existing text principal IDs before granting privileges.
- Implement UI banner and exit action only after endpoints enforce this policy.

## Acceptance gates
- Cross-tenant and unauthorized access denied.
- Audit insert failure rolls back session issuance.
- Concurrent revocation cannot leave an active effective session.
- Reauthentication/revocation invalidate switching immediately.
- Database RLS and grants tested with anon/authenticated roles.
- Registration consent approval and hosted certification remain blocking.
