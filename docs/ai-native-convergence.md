# I-WAY AI-native convergence — implementation and release gates

## Authoritative implementation state

Reference branch: `feat/ai-native-decision-plane`. This document is not a certification report.

- The operations command engine uses SQLite with synchronous transactions, tenant-scoped resources, optimistic resource versions, command idempotency and append-only audit.
- AI policy commands (`aipolicy:propose`, `aipolicy:approve`, `aipolicy:revoke`) are installed as Operations extensions and require carrier governance authority.
- The AI policy lifecycle is versioned, requires distinct proposing and approving principals, and revocation disables the policy.
- The runtime uses bounded deterministic advisory agents. Checkpoint evidence records policy classification but does not authorize external execution.
- PostgreSQL is a restricted async readiness adapter, not a production replacement for the synchronous Operations engine. Hosted RLS and command parity are not certified.
- Browser, hosted and multi-process recovery certification must be executed against the target commit.

## Batches 31–50 evidence register

| Batch | Goal | Status | Gate |
|---|---|---|---|
| 31 | Repository inventory | IMPLEMENTED_UNVERIFIED | Complete repository inventory and local status |
| 32 | Branch reconciliation | BLOCKED | Inspect local dirty tree; remote branch is ahead of main |
| 33 | Policy version reconciliation | IMPLEMENTED_UNVERIFIED | Run persisted lifecycle regression |
| 34 | Immutable policy metadata | IMPLEMENTED_UNVERIFIED | Run policy hardening tests |
| 35 | Extension registration | IMPLEMENTED_UNVERIFIED | Run Operations integration tests |
| 36 | Transaction and rollback consistency | IMPLEMENTED_UNVERIFIED | Run persistence regression |
| 37 | Decision-plane integration | IMPLEMENTED_UNVERIFIED | Run decision and runtime tests |
| 38 | Full test remediation | BLOCKED | Run npm run verify |
| 39 | Architecture documentation | IMPLEMENTED_UNVERIFIED | Review against current branch |
| 40 | Canonical local certification | BLOCKED | Run npm run ops:certify |
| 41 | Trusted decision context | IMPLEMENTED_UNVERIFIED | Tenant and authorization tests |
| 42 | Policy lifecycle | IMPLEMENTED_UNVERIFIED | Full persisted lifecycle regression |
| 43 | Workflow approval integration | NOT_STARTED | Connect to existing workflow approvals |
| 44 | Approval expiry | NOT_STARTED | Expiry and negative E2E tests |
| 45 | Approval replay denial | NOT_STARTED | Replay and stale decision tests |
| 46 | Mid-execution revocation | IMPLEMENTED_UNVERIFIED | Run claim/revocation test |
| 47 | Autonomy level enforcement | IMPLEMENTED_UNVERIFIED | Decision-plane policy tests |
| 48 | Decision provenance | IMPLEMENTED_UNVERIFIED | Runtime checkpoint evidence tests |
| 49 | Tenant security certification | BLOCKED | Execute security and hosted RLS gates |
| 50 | Governance golden journey | BLOCKED | Complete workflow approval and browser E2E |

## Non-negotiable constraints

- Do not activate live inference, dispatch, outbound messages, payments, or waitlist submissions.
- Do not interpret `ELIGIBLE_FOR_ORCHESTRATION` as authorization to execute.
- Revalidate tenant, principal, resource, policy, approval, and lease authority at action boundaries.
- Never invent confidence or cost measurements; unknown is not equivalent to 1.0 or zero.
- Keep the local dirty working tree intact. Never force merge, reset, or clean without approval.
- Report actual executed test commands, source SHA, environment and evidence for each certification gate.

## Required local verification

```powershell
git status
git fetch origin
git pull --ff-only origin feat/ai-native-decision-plane
node --test tests/ai-policy-persistence-reconciliation.test.mjs
node --test tests/ai-policy-*.test.mjs
npm run verify
npm run ops:certify
npm run ops:certify:validate
```

Hosted and browser checks are separate release gates; local success does not certify them.
