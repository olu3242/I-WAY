# Local integration and provider boundaries

Signed inbound messages require a server-configured tenant provider, a recognized signing key, bounded canonical body, HMAC-SHA256 verification and a five-minute age window with at most 30 seconds of future clock tolerance. Provider plus event ID is unique. An identical repeat returns existing evidence; changed evidence under that ID is rejected. Signatures and keys are not persisted. Default provider configuration is empty.

Canonical version 1 events cover shipment, driver, vehicle, milestone, document and delivery. Driver/vehicle/document/stop references are resolved against the current tenant shipment; document hashes must match existing evidence. Raw GPS, free-form URLs, signature images, extra fields, unsupported versions and future reports are rejected. Reports are stored as provider_reported_unverified, applied=false and requiresHumanReview=true. They never mark a delivery, driver, document, payment or shipment state complete.

The outbox persists canonical evidence, requester, load version, attempt count and a lease/fence. A short atomic claim rechecks current role, grants, relationship and shipment version. Completion rechecks authority, lease ownership/fence, provider binding and bounded result shape. Two independent Node processes contend for exactly one claim in the test. Three failed attempts become dead letter, exponential retry delays are persisted, and the circuit opens with a 30-second cooldown and one half-open probe. Retry/reset requires current human authority and a reason. Local adapter results explicitly state externalDelivery=false.

runIntegrationTick is a server-callable local worker contract; default application composition does not install a provider or start external delivery. Real transports, webhook ingress deployment, provider rotation and delivery observability require separate approval and implementation review.

The governed advisory adapter accepts a bounded server-scoped context of shipment identity/version/status and purpose-specific evidence counts/readiness. It omits names, document bodies, money amounts, private contact fields and full resource objects. Finance/document contexts require their additional current grants. Advice is immutable, includes provenance/context hash, and is permission checked again on replay.

No model is configured. The installed adapter is deterministic local rules with model=null, modelInferenceCount=0, inferenceCostUSD=null and modelProviderStatus=BLOCKED. The tool allowlist is empty, consequential actions require existing human approval, and schema violations, fabricated recommendations, attempted tool calls, failures and timeouts fall back to bounded deterministic labels. Evaluation hooks receive minimized provenance and actual local elapsed time; they do not establish model quality.

Regression suites:
- tests/operations-integration.test.mjs: 8 real local inbox/outbox/signature/retry/lease/current-authority cases.
- tests/operations-interoperability.test.mjs: 3 six-event mapping, schema and relationship cases.
- tests/operations-provider.test.mjs: 6 actual local context/policy/fallback/evaluation cases.

No hosted integration, live provider, external recipient delivery or model inference was executed.
