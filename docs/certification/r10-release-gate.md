# R10 Consolidated release decision gate

Run `node scripts/r10-release-gate.mjs dossier.json` against a reviewer-curated dossier tied to **one immutable candidate commit**.

Requires verified R1 archive and branch reconciliation, successful CI for that same commit with browser and security checks, independently accepted R2–R9 records with immutable evidence digests, and explicit security, operations, product and production-change approvals.

This tool validates dossier **structure and declared results**. It does not authenticate signatures, consult the GitHub API, verify archive bytes or grant production deployment authority. Use the trusted evidence system and independent approvers to validate provenance. Even a complete dossier yields `ELIGIBLE_FOR_RELEASE_REVIEW`, not GO or permission to deploy.

The current I-WAY branch lacks independently verified hosted prerequisites; release remains **NO-GO**.
