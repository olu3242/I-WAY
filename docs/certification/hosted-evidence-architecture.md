# Hosted evidence architecture (B256)

Local fixture evidence and independent hosted attestation are separate trust domains. Existing PARTIAL, LOCAL_GATE_EVIDENCE_ONLY, LOCAL_FIXTURE_RECORDED and NO-GO decisions remain conservative.

The intake boundary accepts bounded JSON artifacts and signed lifecycle requests, never executable commands, credentials, connection strings or transport modules. Evidence binds tenant, non-production environment, exact source fingerprint, Git commit, artifact bytes, collector, scenario assertions and authorization reference. Canonical digests and Ed25519 signatures bind the entire record and each action.

Trust must be bootstrapped outside submitted evidence: an administrator provisions pinned public keys, action/tenant/environment scopes and revocation records. A caller cannot submit a public key as its own approval. No production trust keys or authorized hosted transport are provisioned in this implementation. CLI hosted execution therefore remains blocked. Ephemeral test keys prove verifier behavior only.

A SQLite event ledger serializes mutations with BEGIN IMMEDIATE, optimistic revisions and idempotency keys. Lifecycle events retain signed requests and a hash chain. Inspect/reconcile validates the chain, signatures, current trust status, artifact bytes and source binding. SQLite and artifact directories must be writable only by the trusted service account. Hash chains cannot resist privileged whole-store rollback without an independently retained signed checkpoint; release evidence must not claim otherwise.

Lifecycle: DRAFT -> SUBMITTED -> VALIDATED -> REVIEWED -> ACCEPTED. Rejection, revocation, expiration and supersession are terminal. Collector cannot independently review or accept its own evidence. Expiry/revocation are re-evaluated at use time. No deletion command is provided.

Seven scenario harnesses use fixed typed operation contracts and fail-closed assertion evaluators. A server-controlled transport must enforce an authorized non-production endpoint, tenant, approved synthetic fixture, restricted identity and no real delivery. No arbitrary module loading or URL execution is provided. Local harness tests are adapter-contract tests, not hosted observations.
