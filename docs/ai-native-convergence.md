# I-WAY AI-native convergence

## Status
Wave 1 foundation only. The decision-plane module is a pure policy evaluator; it does not call an AI model, mutate state, authorize database access, or dispatch workflows. Tests have been committed but have not yet been run in CI or locally.

## Required integration sequence
1. Discover existing shipment events, tenant authorization, approval state machines, queue contracts, worker fencing, evidence and measurement modules on the authoritative code branch.
2. Translate validated model proposals into the decision contract; never trust model-produced tenant IDs or permissions.
3. Resolve tenant identity and versioned policy from trusted server-side context.
4. Record immutable decision and policy evidence; assign idempotency keys before orchestration.
5. Invoke existing workflow OS only after server-side authorization and risk gates. `ELIGIBLE_FOR_ORCHESTRATION` is not permission to bypass action authorization.
6. Route `APPROVAL_REQUIRED` through the existing human approval state machine, including expiry and replay protection.
7. Certify concurrent workers, recovery, cross-tenant denial, AI outages and external connector failure before enabling live actions.

## Deployment gates
No live AI actions, outbound communications, autonomous routing, or waitlist activation are enabled by this change. Hosted and browser E2E certification are outstanding. Keep existing runtime behavior unchanged until verified.
