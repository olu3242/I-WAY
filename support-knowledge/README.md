# I-way AI Service & Knowledge Plane — Two-batch implementation
## Batch 1: knowledge foundation
- `personas.mjs`: fourteen personas, controlled 26-SOP catalog and SOP validation.
- `access.mjs`: deny-by-default tenant/role/owner checks; approved-only knowledge retrieval with separate author and approver.
- Knowledge articles are passed by an authorized repository adapter. No production database integration is claimed.
## Batch 2: support orchestration
- `orchestrator.mjs`: intent classification, critical escalation, cited approved-source answers, and fail-closed action proposals.
- `tickets.mjs`: ticket creation, priority policy and auditable state transitions.
- `tests/support.test.mjs`: isolation, retrieval, escalation, approvals and lifecycle checks.
## Execute local tests
```sh
node --test support-knowledge/tests/*.test.mjs
```
## Mandatory integration gates before production
1. Bind identity to verified server session and tenant membership, never user-supplied role/tenant fields.
2. Use PostgreSQL RLS, tenant-scoped repository queries and transaction-safe ticket persistence.
3. Connect to the existing I-way workflow engine; no direct write actions are implemented by these modules.
4. Replace keyword matching with evaluated retrieval and source grounding; redact sensitive data in logs.
5. Add rate limiting, idempotency, human approvals, audit evidence, browser WCAG testing, performance and hosted certification.
6. Keep customer-facing support writes and AI action execution disabled until hosted certification GO.
## Operational ownership
Identity: account access; Carrier: onboarding; Dispatch: loads; Fleet: equipment; Compliance: safety; Finance: settlements; Support: tickets; Security: incidents; Knowledge: article approval; Reliability: recovery.
