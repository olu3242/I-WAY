# Staging password account setup

All four approved tester Auth users were observed with passwords set and confirmed emails. No passwords were read or changed. No Google identities exist; explicit null Google subjects now permit password-only roster entries while Google admission remains denied for those entries. Platform/carrier MFA requirements remain unchanged.

The private setup transaction passed a rollback rehearsal and was then applied. Live user identifiers and the provisioning payload are excluded from this repository. It guards the four existing Auth IDs and confirmed-password status, rejects existing deployment configuration, and creates only isolated staging data: two realms, four identity-only principals, one fleet, three tenant role bindings, four ready broker states, and one approved deployment configuration. Platform governance stays separate from operational tenant access. No loads, vehicles, payments or invitations were created.

Diagnostic deployment dpl_9u2cnTArR8Ee7swyzHwiDFYeNFdP confirmed public signing keys, approved bindings and active tenant relationships PASS using the restricted runtime role. Activation flags were still disabled at that check. Both privileged users currently have zero verified MFA factors, so privileged password access cannot complete until enrollment is implemented/completed; MFA must not be bypassed.

Relationship verification now uses read-only PostgreSQL transactions, avoiding version changes during startup. A disposable PostgreSQL regression checks unchanged state/version and cross-tenant denial. Password-only tests cover successful password sessions, rejected Google admission and retained privileged MFA.
