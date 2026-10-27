# B391-B398 Hosted Identity Certification Gate

Status: **NO-GO / EXPERIMENTAL**. This branch is not a production migration and must remain draft until the independent gates below are evidenced.

## Implemented, isolated
- B391: disposable PostgreSQL onboarding schema, forced RLS, append-only audit.
- B392-B393: restricted invitation transitions, acceptance, concurrency and rollback checks.
- B394: injected trusted identity-verification boundary (not a cryptographic verifier).
- B395: transactional fixture account and tenant-role provisioning; no live account/session grants.
- B396: verified-claim-to-provisioning composition.
- B397: single-use token digest ledger and PostgreSQL concurrent replay test.
- B398: injected session verification and tenant-role authorization boundary.

## Release-blocking gaps
1. Integrate a reviewed OIDC verifier with pinned issuer, audience, JWKS rotation, token expiry/not-before, nonce, authentication age and explicit assurance policy. Current injected verifier callbacks alone do not authenticate tokens.
2. Bind the verified identity subject to the invitation using the **same canonical subject hashing policy** as invitation creation. Verify tenant and role assignment server-side, not from a user-supplied role.
3. Replace fixture-only SQL with reviewed migrations, least-privileged DB grants and tested per-tenant RLS policies. FORCE RLS with no policies currently denies ordinary roles.
4. Verify transaction wrapper truly commits or rolls back the proof ledger, account, role binding, invitation activation and audit as one unit; run real PostgreSQL fault-injection tests.
5. Implement and test live account/session issuance, revocation, token renewal, tenant switching and authorization on every protected HTTP endpoint. The B398 contract only checks an injected session and binding.
6. Run hostile tests for cross-tenant reads/writes, replay with different invitations, stale tokens, role escalation, subject collisions, revoked invitations and concurrent requests.
7. Verify the four proposed tester identities with explicit owner approval before any live provisioning. Do not send invitations or grant production access from this branch.
8. Resolve draft PR stack, complete independent security review and all CI workflows before merge. A green fixture workflow is not hosted certification.

## Required acceptance evidence
- Real OIDC token verification and key-rotation test logs with secrets redacted.
- Hosted PostgreSQL transaction and RLS tests using restricted service principals.
- Browser and HTTP end-to-end signup/invite/accept/activate/revoke tests.
- Rollback, replay, audit and least-privilege security sign-off.
- Explicit GO decision after production change approval.

No production access changes are authorized by this document.
