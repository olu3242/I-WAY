# I-way AI SOP API Reference

**Document version:** 0.1.0-draft  
**Status:** Internal module contracts implemented; HTTP endpoints not implemented. Hosted release **NO-GO**.  
**Source:** `support-knowledge/*.mjs` at branch `docs/iway-sop-api-changelog-b4`.

## Scope and integration model

These are **server-side JavaScript function contracts**, not REST endpoints. Do not expose these functions directly to browsers. Identity must originate from a verified server session and tenant membership, not from request JSON. `session.verified` and `session.tenantMembershipVerified` are currently trusted flags supplied by the caller; no real session verifier is wired in.

### `handleSopRequest({session,message,resource,repository,now?})`
- **Purpose:** Resolve support intent and retrieve tenant-scoped approved knowledge.
- **Session:** `{verified:true,tenantMembershipVerified:true,subjectId,tenantId,role}` from a trusted server adapter.
- **Resource:** `{tenantId,ownerId?,allowedRoles?}` resolved by the server.
- **Repository port:** `listApprovedArticles({tenantId,role}) -> Article[]`.
- **Results:** `{status:"answered",intent,answer,citations:[{articleId,version,source}]}`; `{status:"escalate",priority,reason,intent}`; `{status:"denied",reason}`; or `{status:"unavailable",reason}`.
- **Limitations:** Keyword retrieval only. No model-generated answers, production retrieval evaluation, or HTTP handler.

### `submitSopTicket({session,resource,subject,priority?,repository})`
- **Purpose:** Create a ticket only when the transactional repository returns a verified receipt.
- **Repository port:** `createTicketTransaction({tenantId,actorId,ticket}) -> {persisted:true,tenantId,ticketId}`.
- **Results:** `{status:"created",ticketId,tenantId}`, `{status:"denied"}`, or `{status:"unavailable",reason}`.
- **Priority:** P0–P4; default P3. `subject` required, truncated to 300 characters.
- **Limitations:** No real server route or live database certification.

### `advanceSopTicket({session,ticketId,next,note?,repository})`
- **Purpose:** Request a tenant-scoped, authorized ticket transition.
- **Repository port:** `transitionTicketTransaction({tenantId,actorId,ticketId,next,note}) -> {persisted:true,tenantId,ticketId}`.
- **Results:** `{status:"transitioned",ticketId,transition:next}`, `{status:"denied"}`, or `{status:"unavailable",reason}`.
- **Allowed transitions:** open→triaged; triaged→assigned; assigned→waiting_customer/resolved; waiting_customer→assigned; resolved→closed/assigned. Closed is terminal.
- **Limitations:** Runtime adapter delegates atomic transition checks to repository; no HTTP route.

### `createSopPostgresRepository(pool)`
- `listApprovedArticles({tenantId,role})`: parameterized tenant/role lookup.
- `createTicketTransaction({tenantId,actorId,ticket})`: transactional insert, verified receipt.
- `transitionTicketTransaction({tenantId,actorId,ticketId,next,note})`: row lock, conditional update, audit insert, rollback on error.
- **Security warning:** Existing adapter does not bind a verified tenant identity using transaction-local database settings. B4 RLS policy SQL therefore must not be considered integrated with this adapter. Do not grant runtime access or execute hosted operations until this is corrected and tested.

## Authorization and data handling
- Four app surfaces: Driver Mobile, Carrier Admin, Fleet Company, Platform Admin. **No SOP HTTP integration has been certified for any surface.**
- Access control is deny-by-default; tenant IDs and role are derived from verified server identity.
- The application role must not be superuser, table owner, or BYPASSRLS; do not allow untrusted callers to set custom database identity settings.
- Never log credentials, customer messages, ticket subjects, or full knowledge bodies in certification output.
- All database changes are local-review only. B3 and B4 SQL files have not been applied or tested against a real database.

## Planned HTTP API (NOT IMPLEMENTED)
Potential future routes, subject to API review and certification:
- `POST /api/v1/support/resolve`
- `POST /api/v1/support/tickets`
- `POST /api/v1/support/tickets/{ticketId}/transitions`

**These paths are design proposals only.** There are no deployed endpoints, guaranteed response codes, OpenAPI specification, or public API version commitments.

## Testing and release evidence
- B1: 17/17 local tests passed (user-provided).
- B2: 23/23 local tests passed (user-provided).
- B3: 26/26 local tests passed (user-provided).
- B4: three new static contract tests committed, not yet confirmed executed.
- Real PostgreSQL RLS, isolation, concurrency, browser E2E and hosted release: **not certified**.
- Hosted decision: **NO-GO**.

## Change management
Update this document and `support-knowledge/CHANGELOG.md` whenever a function signature, permission, schema, security gate, or release status changes. Never label a contract as deployed until runtime evidence exists.

## B5 internal transaction context (implemented helper, not production authentication)
`withSopTransaction(pool, identity, run)` starts a transaction, sets `iway.verified_tenant` and `iway.verified_actor` with transaction-local `set_config`, invokes `run(client,{tenantId,actorId})`, then commits or rolls back and releases the client. Identity requires `verified:true`, `tenantMembershipVerified:true`, `subjectId` and `tenantId`. **These flags must be created by a trusted server verifier; caller-provided flags are not proof.** The existing repository adapter has not yet been refactored to use this helper. No HTTP endpoints or hosted integration are enabled.

## B6 HTTP integration (internal, opt-in only)
The server now supports an **optional** `sopHandler` injected into `makeApp`. When absent, `/api/v1/support/*` responds `503 support_unavailable`. `createSopHttpHandler({verifySession,resolveResource,repository})` implements POST `/api/v1/support/resolve`, POST `/api/v1/support/tickets`, and POST `/api/v1/support/tickets/{ticketId}/transitions` only when explicitly injected with trusted server-side ports. The default startup does **not** inject this handler. No frontend wiring, deployed endpoints, real session verifier or database certification is claimed. Error responses: 400 invalid JSON, 401 unauthorized, 403 forbidden, 404 unknown route, 413 oversized, 415 content type, 503 unavailable.

## B7–B10 integration interfaces (staged, not deployed)
- `createBoundSopRepository(pool,identity)`: transaction-local database identity binding for article lookup, ticket insert, and ticket transition. Identity must come from trusted server verification; not yet exercised against PostgreSQL.
- `createSopSessionVerifier({verifyBearerToken,lookupMembership})`: verifies token via injected trusted provider and active membership lookup; no actual provider connected.
- `createSopClient({getAccessToken,fetchImpl?,baseUrl?})`: browser-side client for resolve/create/transition. No frontend application screen or token provider connected yet.
- Six B7–B10 integration contract tests. They use mocks; no real PostgreSQL, browser navigation, or hosted certification.
- **Integration gap:** server startup still does not inject the SOP HTTP handler. No production or customer-facing exposure.

## B11 staged composition
`createSopComposition({verifyBearerToken,lookupMembership,pool,resolveResource})` is a **fail-closed integration checkpoint**, not a live deployment. It rejects missing dependencies, verifies tokens through injected server ports, and currently rejects repository operations because B6's HTTP handler has no per-request repository factory. Default server startup remains unchanged. Next implementation must introduce request-scoped repository binding, restricted PostgreSQL role, and genuine identity-provider integration before activation.

## B12–B14 request-scoped HTTP to SQL integration
`createSopHttpHandler` now optionally accepts `repositoryForSession(session)`. After trusted `verifySession` and resource resolution, it creates a request-scoped repository. `createSopComposition` uses `createBoundSopRepository(pool,session)`; the SQL adapter binds actor and tenant inside a transaction. B14 includes an HTTP-to-mocked-SQL success path and membership denial. **Not yet certified against real PostgreSQL or a live identity provider; no four-application UI integration or hosted deployment.** The application startup remains disabled by default.

## B15 single-batch integration checkpoint
- `/support.html` provides a shared accessible support form and imports `support-ui.js`; it stays disabled without an injected `globalThis.iwayAuth.getAccessToken` provider. This is **not** integration into the four distinct app shells.
- `support-knowledge/scripts/verify-postgres.mjs` performs a read-only isolated database smoke probe with a restricted non-owner, non-bypass role. It requires `IWAY_SOP_ISOLATED_DATABASE_URL` and `IWAY_SOP_ISOLATED_CONFIRM=YES`. It does not prove write policies, multi-tenant isolation, or hosted readiness.
- Default server startup does not activate SOP endpoints; production identity and tenant membership implementations remain to be connected. No secrets belong in browser assets.

## B16 local certification contract
The read-only probe requires IWAY_SOP_ISOLATED_CONFIRM=YES and IWAY_SOP_ISOLATED_DATABASE_URL pointing to loopback port 55432, database iway_sop_cert, login iway_sop_cert. It switches to iway_sop_runtime inside a transaction and checks forced RLS. This is not write/rollback, cross-tenant, or hosted certification. Custom tenant GUCs must only be bound by trusted server code; they are not authentication proofs. Hosted release NO-GO.
