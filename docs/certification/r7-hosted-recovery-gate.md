# R7 Hosted recovery acceptance gate

The local `scripts/operations-recovery-rehearsal.mjs` exercises a disposable SQLite fixture. That is useful local evidence, **not** a hosted PostgreSQL recovery certificate.

Run `node scripts/r7-hosted-recovery-gate.mjs evidence.json` with authorized hosted nonproduction observations: pinned commit, backup manifest digest, restored audit-chain and tenant isolation checks, measured RPO/RTO, independently approved objectives, healthy application and reviewer evidence digest.

A passing evaluator result means `ELIGIBLE_FOR_REVIEW`, not production approval. Missing, unapproved or out-of-SLO evidence is `NO-GO`. This evaluator never initiates a hosted restore.
