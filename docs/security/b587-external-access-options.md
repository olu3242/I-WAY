# B587 — External tester entry decision

Read-only assessment, 2026-10-23. No billing, shares, bypass credentials, DNS, deployment or protection changes performed. Recorded account inspection: Hobby plan active; SSO protects all staging deployments.

| Option | Eligibility and cost | Security and approval |
| --- | --- | --- |
| Individually shared Vercel external collaborators | Hobby allows one collaborator at a time, insufficient for four. Pro permits multiple; published starting price $20/month plus applicable usage/seats/tax. Confirm checkout terms before approval. External collaborators require Vercel accounts for a protected deployment, without becoming team members. | Recommended after engineering blockers close: owner/admin approves eligible plan and four exact-email deployment shares on a genuine Preview. Preserve SSO; grant no team membership. Independently verify share revocation and fifth-user denial. |
| Separate Cloudflare Access protected UAT origin | Published Zero Trust Free tier covers up to 50 users; paid option lists $7/user/month. Origin hosting, domain, usage and implementation costs additional and not yet quoted. | Separate protected origin with four-email Google identity allowlist, short sessions, deny-by-default and audited revocation. Keep current Vercel deployment untouched. A gateway placed in front of its existing SSO does not remove that SSO requirement. Use a separately approved private origin with direct-origin denial, not a hidden publicly reachable clone. Requires hosting/DNS/provider/allowlist approval and new integration tests. |

Both entry methods precede I-WAY's own verified identity, approved role, permission, tenant, relationship and resource checks. Google sign-in alone is never authorization. Never distribute a shared protection-bypass credential to human testers.

The separate gateway is a design alternative, not implemented infrastructure. Its signed gateway assertion must be validated for issuer, audience, signature and expiry; ignore spoofed identity headers, retain independent I-WAY login/MFA, block direct ingress and test removal/replay. Hosting plan and origin design remain TBC. It does not resolve the missing persistent Operations adapter.

Minimum staged approvals: (1) verified synthetic tenant hierarchy and explicit existing/new identity and membership provisioning scope, including platform privileges and MFA; (2) scoped schema/runtime credential and dual-auth activation approval; (3) eligible Vercel plan expenditure and four individual Preview shares OR separate protected-origin design and spend; (4) exact Preview deployment source/origin/callback approval. Invitations/delivery require separate explicit authorization. Approvals alone do not override failed tests.

Sources checked directly:

- [Vercel external collaboration and sharing](https://vercel.com/docs/deployments/sharing-deployments)
- [Vercel plan prices](https://vercel.com/pricing)
- [Cloudflare Zero Trust plans](https://www.cloudflare.com/plans/zero-trust-services/)
