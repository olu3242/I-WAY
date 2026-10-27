# Hosted execution runbook

No hosted resources were accessed by this batch. A real trusted transport, approved non-production infrastructure and out-of-band pinned authority keys are not configured. Hosted execution remains 0/7.

## Local validation
Run npm run ops:certify, then npm run ops:certify:validate. Set IWAY_OPERATIONS_LOCAL_OPT_IN=1 for the explicitly disposable PostgreSQL runner. Run node scripts/certify-isolated-scenarios.mjs and its validate mode. Finally run npm run ops:release:check and npm run ops:release:validate. Stop on any nonzero exit. Any source change requires regenerating this chain; never edit evidence hashes.

## Operator commands
- node scripts/hosted-evidence.mjs dry-run: offline canonical plan and conservative readiness.
- node scripts/hosted-evidence.mjs intake <evidence-root>: validate signed request.json and append a lifecycle event.
- node scripts/hosted-evidence.mjs inspect <evidence-root> <record-id>: verify record, artifact and audit chain.
- node scripts/hosted-evidence.mjs validate <evidence-root> <record-id>: same read-only integrity check.
- node scripts/hosted-evidence.mjs reconcile <evidence-root>: revalidate all tenant-bound records.
- node scripts/hosted-evidence.mjs preflight <evidence-root>: verify authorization.json and all prerequisite signatures and bytes; report missing transport.
- node scripts/hosted-evidence.mjs execute <evidence-root>: fails closed without installed trusted transport. This CLI does not dynamically import plugins or execute submitted URLs/commands.
- node scripts/hosted-evidence.mjs readiness <evidence-root>: independently assess accepted records, authorization, optional security-approval.json and production-approval.json, plus the external checkpoint.

## Trust provisioning (external approval required)
An authorized administrator must provision a service-owned evidence root and a separate trust root outside it. Set IWAY_EVIDENCE_TRUST_ROOT to that root and IWAY_EVIDENCE_TRUST_SHA256 to an independently verified SHA-256 of policy.json. Neither is a credential. Do not derive the pin from an untrusted upload. Policy fields are tenant, environment, keys, revokedAuthorizations, revokedAttestations and ledgerDigest (null until independently checkpointed). The process environment and trust directory are privileged configuration. Restrict ACLs so evidence submitters cannot modify them. Do not put secrets in arguments, environment dumps or artifacts.

Authorized external signing services generate lifecycle requests; this CLI deliberately has no private-key signing command. Import actual artifact bytes before submission. Reviewers validate observations and provenance independently before signing REVIEWED and ACCEPTED. Security/release reviewers sign the current ledger digest. Revocations must update the authoritative policy and pin, not just a local mutable evidence flag.

## Hosted adapter integration
The fixed runHostedScenario API accepts only a server-installed opaque transport handle. Reviewed server composition must install all seven operation adapters, bind exact approved non-production infrastructure and tenant, enforce synthetic fixtures/no real delivery, honor cancellation, and return separately signed execution observations. The runner validates scoped approvals before execution and again afterward, limits execution to 30 seconds, rejects unsigned observations and computes canonical assertions from typed facts. No transport was installed or run here. Adapter contracts are locally tested with explicitly labelled fixtures, not represented as hosted certification.

## Recovery, rollback and retention
Preserve ledger.sqlite with its WAL consistently using an approved SQLite backup procedure; retain artifacts, signed envelopes and the independently stored checkpoint together. Reconcile after recovery and compare against the external checkpoint; mismatches remain NO-GO. Never delete audit history to resolve errors. Expire, revoke or supersede records. Retention period and legal holds: [TBC] by the authorized owner. No destructive cleanup or retention command is provided. Deployment rollback requires approved artifact and backup digests, isolated restore, health and audit-continuity observations; production approval never follows from a local rehearsal alone.
