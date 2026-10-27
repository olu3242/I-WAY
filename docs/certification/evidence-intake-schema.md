# Evidence intake schema — version 1

The authoritative validators are domain/hosted-evidence.mjs and server/hosted-evidence-store.mjs. Unknown record, artifact, authorization and signed-request fields are rejected.

Record fields: schemaVersion=1; id; canonical batch ID; canonical scenario ID or null; tenant; environment (staging or isolated-hosted); sourceHash (64 lowercase hex); gitSha (40 lowercase hex); artifact {path,sha256}; collector; collectedAt; method (fixture-runner or approved-hosted-runner); result (PASS or FAIL); assertions (exact canonical scenario keys, boolean); authorizationRef; expiresAt; provenance {scope,runId}.

Artifact paths must be artifacts/<sha256>.json. Actual bytes must match the digest and parse as a bounded strict summary containing schemaVersion, runId, scenario, tenant, environment, sourceHash, gitSha, scope, result and assertions. Maximum size: 256 KiB; nesting: 12; nodes: 10,000; individual string: 4096. Credential markers, sensitive keys, invalid UTF-8, traversal, symlinks, hardlinks and changed bytes are rejected. This restricted structured-summary format deliberately excludes raw logs and binary uploads; reference separately reviewed external material through signed prerequisite attestations.

Envelope: {keyId,payload,signature}. Signatures are Ed25519 over canonical JSON (sorted object keys, preserved array order). Public keys come only from operator-installed trust policy. The evidence itself cannot supply its own trusted key.

Lifecycle payload: {recordId,recordDigest,from,to,revision,at,requestId,authorizationRef}. Creation is revision 0, null -> DRAFT. Subsequent requests increment revision exactly once and use a unique idempotency key. Identical retries are safe; conflicting retries fail. The signing key subject must match the collector at creation. REVIEWED and ACCEPTED require a signer independent of the collector. Independent reviewer and approval timestamp derive from signed audit events, not record-supplied authority flags.

Authorization payload: {schemaVersion,id,tenant,environment,sourceHash,gitSha,scenarios,prerequisites,notBefore,expiresAt,syntheticOnly,noRealDelivery}. Both safety flags must be true. Each of the eight canonical prerequisites requires its own purpose-scoped signed attestation and actual digest-verified JSON evidence bytes under attestations/<sha256>.json. Attestation fields: id, prerequisite, tenant, environment, sourceHash, gitSha, evidenceSha256, approvedAt, expiresAt. Revocation is checked at every use.

Trusted key fields: subjectId, publicKey (Ed25519 public PEM), purposes, tenants, environments, notBefore, expiresAt, revoked. Purpose strings include transition:<STATE>, approve:<canonicalPrerequisite>, authorize, execute:<scenario>, security-release and production-release. Grant only the required purposes. No private key belongs in the trust file or intake directory.

Release approval payload: {purpose,tenant,environment,sourceHash,gitSha,ledgerDigest,approvedAt,expiresAt}. Separate security and production approvals are checked. A current externally retained ledgerDigest checkpoint is also required, preventing a locally rolled-back ledger from silently satisfying the release gate.
