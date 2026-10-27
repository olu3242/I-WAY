# Provider certification

Preserved original local hardening was incorporated into this isolated branch: current governance checks at intake/claim/completion/failure, cancellation signal on bounded delivery, purpose-specific advisory access, current policy version evidence, and isolated observer failures. Original modified files remain untouched.

The optional bounded HTTPS adapter only accepts explicitly supplied local fixture I/O. No native network implementation or provider credentials are installed. Contract checks include strict destination validation, TLS verification, pinned public IPv4 lookup, bounded request/response/header sizes, signed receipts bound to tenant/event hash/idempotency key, timeout and caller cancellation, incomplete/malformed response rejection, and normalized 429/503/redirect failure. Existing integration service retains retry/circuit/lease/dead-letter ownership.

Existing signed callback tests cover invalid/expired signatures, revoked keys/provider availability, altered replay and tenant binding. Signed provider evidence never directly advances the shipment. Live provider, credentials, commercial contracts, live AI and real callback endpoint certification remain BLOCKED. These simulated tests cannot certify a provider's real behavior or agreement.

Evidence: operations-transport.test.mjs (4 contract tests), operations-provider.test.mjs (8), operations-integration.test.mjs (9), plus full verification. Intermediate projection bug failed the first broader run; fixed before final verification. No failure log was overwritten.
