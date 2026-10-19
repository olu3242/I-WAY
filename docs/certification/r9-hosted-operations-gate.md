# R9 Hosted operational readiness acceptance gate

Run `node scripts/r9-hosted-operations-gate.mjs evidence.json` with actual approved hosted nonproduction evidence. Required controls: trusted transport and signed observations, least-privilege credentials and TLS, tenant binding, durable audit and alerting, error budgets and traces, rollback rehearsal, incident response, backup/restore, capacity and independently approved vulnerability/access/retention reviews.

This is an evidence-shape and consistency evaluator. It **does not cryptographically verify signed observations**; use the trusted hosted-evidence intake and verification process for authenticity and provenance. It does not access hosted infrastructure or provision credentials.

`ELIGIBLE_FOR_REVIEW` is not a release authorization. Production remains NO-GO until R10 explicitly approves the verified full chain.
