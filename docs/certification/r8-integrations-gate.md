# R8 Sandbox integrations and payments acceptance gate

Run `node scripts/r8-integrations-gate.mjs evidence.json` with independently reviewed approved-sandbox observations. Each named adapter needs authorized contract and failure-path tests. Payment evidence must prove idempotency, reconciliation, duplicate-charge denial and reversal. Webhooks must prove signature checks, replay denial, ordering and retries. Live credentials are prohibited in the sandbox evidence.

The gate validates **submitted evidence structure and declared results**, not signatures, actual provider calls or credentials. Reviewer provenance and immutable artifact verification must be established by the trusted hosted-evidence workflow. It does not initiate any charge, refund, provider request or deployment.

A passing evaluation is `ELIGIBLE_FOR_REVIEW`, not production approval.
