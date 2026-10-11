# Identity readiness

The local authentication path now creates hashed-token sessions with persisted authority fingerprints, a 30-minute idle limit, and an eight-hour absolute limit. A role, grant, activation or relationship change invalidates existing sessions. Legacy sessions without security metadata fail closed. Revocation is atomic and audited; deleting a session cascades its security metadata.

Federated identity is a server-side interface only, not an enabled hosted login route. A server configures an exact HTTPS issuer, audience and trusted RS256 or ES256 public keys. Verification checks signature, algorithm/key ID, issuer, audience, subject, issuance/expiry/not-before and a bounded maximum token age. Unknown header key sources and unsigned tokens are rejected. MFA requires a verified aal2 claim and an internally branded session; a caller-created object cannot satisfy requireAssurance.

Bindings use exact issuer plus a hashed subject mapped to an existing tenant principal. Client email, user metadata, role and tenant claims never grant authority. Binding another identity requires current authority to delegate every target grant. Revoking a binding revokes its sessions. Operators must separately approve a hosted identity provider, key lifecycle, MFA semantics and verified binding ceremony before enabling this interface.

Local password sessions are aal1 and do not claim MFA. No external token, provider key or environment secret was loaded. Test keys and identities are isolated ephemeral fixtures.

Account access changes require a different carrier administrator, the expected authVersion, bounded role grants and current delegation authority. Structural driver, fleet and customer relationship conversions are rejected. Carrier/dispatcher role transitions also require authority for every retained grant, preventing a limited account manager from widening a dispatcher's resource scope. Successful changes increment authVersion and revoke all target sessions. Default role policies were not changed.

The current HTTP operations server remains loopback-only. Production cookies, federated HTTP routes, hosted persistence parity, provider configuration and hosted MFA certification remain BLOCKED; this module is not a production deployment claim.

Run node --test tests/operations-identity.test.mjs tests/operations-auth.test.mjs for actual local signature, malformed-claim, MFA, tenant-binding, revocation, authority-change and privilege-escalation checks.
