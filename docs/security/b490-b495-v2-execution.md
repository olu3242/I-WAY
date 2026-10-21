# B490–B495 V2 execution register

Release: NO-GO. Baseline 8dd8285b85a7a3a68c4b5678946bb7b7232e4f32.

## B490.1 / B490.4 — browser binding and cookie contract
Implemented independent HttpOnly transaction-cookie lookup, code-only Supabase callback handling, optional query-state equality check, server-side transaction creation, replacement cleanup, replay denial, and canonical __Host-iway-session use throughout protected-route fixtures. No token or verifier enters a browser URL.

Focused tests: 72 passed, zero failures/skips. Full npm run verify: 751 passed, zero failures/skips; source, build, IP scan and site checks passed. Remote CI pending commit.

Issue V2-01 (High, callback): repaired query-as-trust defect in server/operations-supabase-pkce-callback-flow.experimental.mjs and parser. Browser mismatch/missing cookie fails before consume or exchange. Repository verified; hosted blocked.
Issue V2-02 (High, cookies): canonical host-only contract shared between helpers and server/operations-supabase-session-http-guard.experimental.mjs. Repository verified; hosted blocked.

Hosted blocker: read-only pg_namespace query again denied by Supabase MCP (-32600) for vnoxdinldneeczxibicp. No schema mutation attempted. Current static preview has no auth routes. Continue repository provider, session rotation, private migration review and function integration before requesting infrastructure action.

Provider contract: https://supabase.com/docs/guides/auth/sessions/pkce-flow. Admin invitations are not treated as PKCE login.
