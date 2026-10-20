# I-WAY consolidated B433-B460 execution and certification matrix

**Status: NO-GO.** Isolated CI does not grant production access. This document records implementation and independently required evidence; it is not evidence of a hosted pass.

| Batch | Acceptance requirement | Evidence required | Current state |
| --- | --- | --- | --- |
| B433-B435 | Strict fenced worker, no legacy fallback on certified path, release gating | PostgreSQL concurrency and negative tests | B433/B434 code + CI gate added; hosted integration pending |
| B436-B440 | Durable distributed nonce custody with atomic fencing | Process-isolated takeover, lease expiration, deletion race | Not implemented |
| B441-B445 | Real process termination, PostgreSQL failover, queue retry, alerts | Restart/failover logs and recovery invariants | Not certified |
| B446-B450 | Hosted OIDC/JWKS rotation, sessions, per-route authorization, least privilege | Hosted identity provider and restricted database tests | Not certified |
| B451-B455 | Four persona journeys (carrier, fleet, platform, driver) | Isolated test identities, negative tenant/role cases, audit logs | Not certified; no real user provisioning |
| B456-B460 | Reconcile PR stack, review security, QA and deployment controls | Independent signoff, green checks, explicit change approval | Not certified; no merge or deployment |

## Hard stop controls

- The strict worker factory requires the current PostgreSQL fencing generation and uses atomic PostgreSQL challenge finalization. Legacy fixture code remains for compatibility and **must not** be used as a production endpoint.
- PostgreSQL challenge cleanup and in-memory nonce deletion remain separate operations. There is **no certified distributed atomicity**.
- No hosted OIDC provider configuration, production database role grants, actual tester invitations, account changes, merges or deployments are authorized by this branch.
- Release evaluation returns NO_GO unless all required evidence flags are independently verified. Even complete evidence returns READY_FOR_HUMAN_GO_REVIEW, never automatic production authorization.
- Do not fabricate successful hosted evidence, signoffs, performance metrics, or an E2E completion percentage.

## E2E signoff checklist

1. Hosted OIDC signature verification with key rotation, expiry, assurance and issuer/audience policies.
2. Session issuance, refresh, revocation and tenant switching tested on every protected route.
3. Restricted PostgreSQL roles and RLS verified for both authorized and denied cross-tenant operations.
4. Durable nonce store implements atomic compare-and-delete fencing with PostgreSQL lease coordination or equivalent single authoritative transaction boundary.
5. Recovery worker restarts after kill -9, expired leases, DB outage and competing workers without unauthorized cleanup.
6. Four persona onboarding paths pass in a disposable environment with explicit user approval before any real invitations.
7. Security review, branch reconciliation, CI, observability, rollback, deployment checklist and human GO signoff.

**No production access changes.**
