# R3 Security and QA delegation acceptance gate

Run `node scripts/r3-security-gate.mjs evidence.json` with independently reviewed hosted nonproduction security observations. Authentication, authorization, tenant isolation and PostgreSQL RLS must pass deny-by-default assertions.

QA persona delegation must be forbidden in production, limited to verified actors and QA-only targets in the same tenant, require an auditable reason, expire in at most 15 minutes and support verified revocation and audit persistence.

The reviewed persona branches contain divergent policy contracts; this gate **does not merge or activate** either branch. Real actor identity must be resolved at the trusted server boundary, never from client-supplied identity claims. A passing evaluator is only `ELIGIBLE_FOR_REVIEW`, not authorization to deploy.
