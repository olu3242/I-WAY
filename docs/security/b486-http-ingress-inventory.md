# B486 — Verified HTTP ingress inventory (2026-10-21)

## Evidence
- GitHub `vercel.json`: `{"version":2,"buildCommand":null,"outputDirectory":"site/public"}`.
- GitHub `package.json`: `type=module`, `engines.node=>=24.13.0`, `start=node server/start.mjs`; these scripts do **not** establish Vercel function routing.
- Connected Vercel project `i-way` (`prj_0vutnbiNCYaxhdrbLfktrsHAvxty`) reports `framework=null`, `nodeVersion=24.x`, `live=false`, and preview deployments with `target=null`.
- Latest inspected READY preview `dpl_8H6E7pqGReMhrNpHSTBbvG3Gzkj4` was built from branch `work/b391-b398-hosted-identity-certification` at SHA `b5a8a60e23382c5db9bb21c7cc28d5b190df004c`, **not** current B485.
- Experimental `server/operations-supabase-node-protected-route.experimental.mjs` is not mapped to a Vercel function or route by the inspected configuration.

## Confirmed request path
Browser -> Vercel managed ingress -> static assets in `site/public`.

## Not established
- No evidence of deployed application-owned Node HTTP request parser, protected HTTP endpoint, or Supabase auth callback route.
- Managed ingress parsing, header normalization, and upstream proxy chain cannot be inferred from `nodeVersion`.
- A READY preview does not certify parser behavior, tenant isolation, or B485 request-smuggling controls.
- No evidence that current feature-branch commits are deployed as an executable Node server.

## Release gate
B487 must identify a supported, isolated staging function entrypoint and validate its routing without touching production. B488-B493 must test real requests at each accessible boundary, distinguish managed platform behavior from application behavior, and collect request/response evidence. Never send request-smuggling probes to production or shared third-party endpoints without authorization. Preserve separate approval for database schema changes and tester provisioning.

**Decision: B486 discovery complete; hosted security certification NO-GO.**
