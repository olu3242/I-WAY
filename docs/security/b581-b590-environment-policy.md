# B585 — Proposed isolated Preview policy

This is an unactivated proposal, not a deployment or environment update.

The inspected staging deployment `dpl_APs1ZkJVQfADo9H8Vq6wxDFBfPNc` is READY at source `e53192fc076aa3b96f84fc6fb7f2e6b616785fdc`, but its Vercel target is Production. It cannot satisfy `resolveAuthRuntimeConfig`. Keep that rejection. A project name containing staging does not change the target.

After separate approval, build a genuine Preview from this isolated branch in `prj_7uof3CdmN1QvzKxETkXvHjlrLjVm`; keep existing SSO and Production deployment unchanged. Vercel supplies VERCEL_ENV=preview and VERCEL_PROJECT_ID. Never spoof those values in a Production deployment. No main merge is required for this proposal.

Preview-only names required by the candidate:

| Name | Policy |
| --- | --- |
| IWAY_AUTH_ENABLED | true only after activation approval |
| IWAY_AUTH_SCHEMA_APPROVED | b512-v4 only after schema verification |
| IWAY_STAGING_VERCEL_PROJECT_ID | exact isolated project above |
| IWAY_AUTH_ORIGIN | approved stable Preview origin, unresolved |
| IWAY_AUTH_APPROVED_ORIGIN | exact same origin, unresolved |
| IWAY_AUTH_DATABASE_URL | genuine iway_auth_runtime login, server only |
| IWAY_AUTH_PROVIDER | google |
| IWAY_SUPABASE_PUBLISHABLE_KEY | pinned Supabase project's publishable key |
| IWAY_SESSION_ENCRYPTION_KEY | securely supplied persistent server key |
| IWAY_UAT_ENABLED | true only after separate provider/activation approval |
| IWAY_UAT_SCHEMA_APPROVED | b574-candidate-v1 after review-only migration approval |
| IWAY_UAT_DATABASE_URL | separate genuine iway_uat_runtime login, server only |

The inspected name-only Preview snapshot contained none of these 12 names. The local root environment contains origin/provider but lacks the other 10. `node scripts/uat-handoff-preflight.mjs <private-env-path>` reports names only and assumes the recorded empty Preview-name snapshot; it does not query Vercel or validate secret values. Programmatic callers must supply a fresh previewNames inventory to compare against current metadata. No environment file is copied into this worktree or deployment artifacts.

Do not reuse DATABASE_URL (registration identity), SUPABASE_SERVICE_ROLE_KEY, or an administrative connector as either runtime connection. Both intended connection variables are absent locally, so actual hosted session_user/current_user, role flags, grants, RLS and tenant isolation remain BLOCKED. Local disposable PostgreSQL login tests prove implementation behavior only.

Before activation: validate Google redirect allowlists and stable callback URL; verify signed issuer/audience/JWKS; supply explicit reviewed identity/membership/relationship adapters and authorized invitation delivery. The candidate remains excluded from the existing deployment packager. A deployable entrypoint and artifact review are still required.

Operations persistence is another engineering blocker: the existing Operations engine is synchronous SQLite. The bridge proves local integration; it is not a durable multi-instance Vercel Operations backend. Implement and certify a persistent Operations adapter before a hosted application GO. Do not deploy ephemeral SQLite as a substitute.

Sensitive values pasted in conversation require credential-owner rotation/revocation before hosted UAT. No rotation was attempted and no values are reproduced here.
