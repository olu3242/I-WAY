# Hosted onboarding preflight

Observed 2026-10-25 America/Chicago (2026-10-26 UTC).

Both workflows for d5ca84d94763d7d4c184cd3d5a8360f9211fb504 passed: Verify 40249838916 and Identity access certification 40249838851. This closes the disposable database socket shutdown failure.

New read-only probe: scripts/staging-onboarding-probe.mjs. It pins the genuine Preview environment and staging project before connecting, uses the existing restricted Operations role, checks runtime database health inside BEGIN READ ONLY, checks public signing keys through the existing runtime verifier, and validates approved bindings and active relationships through the runtime implementations. Output contains fixed status codes only. Passing prerequisites never claims hosted certification.

Protected diagnostic deployment: dpl_65TLXU6U3KBfMfWsTfVB8Go31Zjt.

| Check | Observed result |
| --- | --- |
| Restricted database runtime health | Passed before prerequisite checks |
| Public asymmetric signing keys | PASS |
| IWAY_AUTH_ENABLED | BLOCKED; not enabled |
| IWAY_UAT_ENABLED | BLOCKED; not enabled |
| Approved deployment bindings | BLOCKED |
| Active tenant relationships | NOT_RUN; dependent on bindings |

A separate read-only aggregate query confirmed zero approved deployment-binding records for the staging project, zero Auth users matching the four approved tester emails, and zero Google identities for that roster. No email addresses, user IDs, provider subjects or credentials were returned by the diagnostic query.

The diagnostic build intentionally exited 1 for BLOCKED; no application activation occurred. No accounts, credentials, tenant assignments or invitations were created. Existing early-access data was unchanged.

Next prerequisite is establishing real Google identities for the approved testers, then populating the reviewed tenant/fleet/principal bindings using those actual provider IDs. Provider identity subjects must never be invented. Auth-only bootstrap and provider callback configuration must be verified before asking testers to sign in. Full hosted workflow certification remains outstanding.
