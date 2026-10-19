# R5 Agent runtime acceptance gate

Run `node scripts/r5-agent-runtime-gate.mjs evidence.json` with actual, independently reviewed nonproduction execution records. Seven distinct named agents (MAX, PULSE, CLARA, GUARDIAN, FINN, SAGE, ATLAS), verified execution identities, durable jobs, authorized handoffs, cross-tenant denial, idempotent retry, dead-letter, resume and audit behavior must be proven.

The existing `scripts/evaluate-operations.mjs` creates **offline deterministic evaluation evidence**, not live-model consent, learning, self-healing or hosted execution proof. Do not infer those capabilities from a local PASS.

`ELIGIBLE_FOR_REVIEW` is not release approval; no runtime execution or external model invocation is initiated by this gate.
