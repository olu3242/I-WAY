# PostgreSQL persistence and worker readiness

B52 is **PARTIAL**. A parameterized async PostgreSQL contract and offline migration exist, but neither PostgreSQL nor its row policies have been executed. B53's durable claims, fencing, heartbeats, retry and recovery are tested against isolated SQLite files and independent worker processes. Hosted PostgreSQL certification remains **BLOCKED**.

No environment file is loaded by this work. Registration credentials are not an operations identity. No hosted role, password, permission, record or service was changed.

## PostgreSQL contract

server/operations-postgres.mjs exports buildOperationsPgConfig, AsyncOperationsPgStore and operationsPostgresReadiness. A caller supplies a pg.Pool built from the validated server configuration and owns its eventual shutdown. Adapter construction does not connect.

Configuration requires an explicitly approved iway_operations_* login, exact project reference, endpoint, database and port 5432. Session Pooler usernames carry the exact project suffix. Direct endpoints carry it in the hostname. Administrative identities and the registration role fail configuration validation. URL query parameters and fragments are rejected so connection-string SSL options cannot replace TLS settings. The existing pinned Supabase CA helper retains rejectUnauthorized: true; no hostname verifier is overridden. [node-postgres SSL behavior](https://node-postgres.com/features/ssl)

Every health check and transaction acquisition verifies the connected client's configuration, encrypted and authorized TLS stream, certificate hostname, database, effective role, absence of elevated memberships and absence of ownership of operations objects. Recording-pool tests exercise those decisions without asserting a real TLS handshake.

The async transaction method binds a trusted server tenantId and actorId:

1. Verify connection health and BEGIN using one acquired client.
2. Parameterize transaction-local tenant/actor settings and statement/lock timeouts.
3. Verify the actor is active in that tenant.
4. Expose only fixed resource, tenant, principal, command-idempotency and audit methods. Each resource query repeats the tenant predicate and uses positional parameters. Updates require the expected version and cannot change ownership fields.
5. Drain issued statements before commit. Failures roll back; failed rollback destroys the connection. All acquired-client paths release the client. Escaped transaction handles reject later calls.

PostgreSQL transactions require the same client throughout, including rollback. [node-postgres transactions](https://node-postgres.com/features/transactions)

This API is asynchronous. The existing synchronous Operations/SQLite engine, authentication, sessions and worker locking are **not wired to it**. Complete business-constraint and authentication parity remain blockers. Role, permission, relationship and ownership checks remain the command engine's responsibility before persistence access.

Tenant/actor settings are server context, not credentials. A principal able to run arbitrary SQL with the server login can change custom PostgreSQL settings. Never accept tenant or actor context from a request body, expose raw SQL, or give this login to browser/Data API clients. Row policies defend against omitted predicates inside the trusted server boundary; they do not authenticate arbitrary clients.

## Offline migration and execution blocker

Supabase CLI 2.117.0 created supabase/migrations/20261011174100_operations_persistence_readiness.sql with its migration-new command. It was **not applied**. No CLI update was installed.

The private schema includes tenants, principals, hashed session fields, resources, idempotency records and audit evidence. All six tables have enabled and forced RLS, tenant select/insert policies, and tenant predicates on both sides of update policies. Composite foreign keys retain tenant scope. Audit and command triggers reject update/delete/truncate; durable immutable evidence rejects update/delete. No delete policy, role creation, password, security-definer function or runtime grant is added. Public and existing Supabase client/service roles receive no access.

Forced RLS covers owners, but superusers and BYPASSRLS roles remain exceptions; connection health therefore rejects those identities and elevated memberships. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

Supabase requires both privileges and policies: RLS does not revoke existing privileges. This migration uses a private schema and explicit revocations. [Supabase row security](https://supabase.com/docs/guides/database/postgres/row-level-security)

The Supabase changelog was reviewed on 2026-10-11. The recent PostgreSQL 15.19/17.11 extension/operator and legacy-cipher notice does not affect extensions used by this migration, which creates none. Auth/framework deprecations do not enable hosted persistence. [Supabase changelog](https://supabase.com/changelog)

Read-only availability checks found Docker CLI installed but no reachable Docker Desktop Linux engine; psql was unavailable. No daemon was started, image pulled, server installed or hosted connection attempted.

Next gates:

1. Authorize an isolated local PostgreSQL server and dedicated fixture-role provisioning procedure.
2. Apply only there; execute real same-tenant, cross-tenant, missing-context, insert/update WITH CHECK, public/client, owner/FORCE, immutable audit/truncate, rollback and pooled-context tests.
3. Verify business constraints, authentication/session storage, authorization and async command-engine parity before selecting this adapter.
4. Separately approve the operations-specific hosted identity, least privileges, TLS endpoint and deployment plan. Never reuse registration or owner credentials.
5. Apply hosted migrations and run certification only with explicit authorization and resolved consent/release gates.

## Durable heartbeat contract

heartbeatJob renews only a running job with matching tenant, worker, fence, checkpoint and run number, and an unexpired lease. It rechecks current human role/permissions, load relationship/version, governance policy and tool scope. Revocation blocks the job and increments its fence.

Renewals accept 100–60,000 ms and cannot exceed 120,000 ms from claim start. They preserve the fence, persist heartbeatAt/heartbeatCount, and audit bounded metadata. Older leases lacking a lifetime deadline are not silently extended; they may complete or expire before reclaim. A reclaimed lease receives a new fence and lifetime. Stale completion cannot create a decision.

runRuntimeTick defaults to a 30-second lease and 10-second heartbeat, with validated server-only overrides for isolated tests. Asynchronous adapters remain outside SQLite write transactions. Timers are cleared on completion/failure. Connector timeouts, bounded attempts and human retry/cancel remain enforced.

Tests use real delayed adapters, restart, independent concurrent processes racing heartbeat against reclaim, authority changes and stale completion. This establishes supported same-host SQLite behavior; it does not certify multi-host SQLite or hosted PostgreSQL workers.

## Reproduce local evidence

~~~powershell
node --test tests/operations-postgres.test.mjs tests/operations-heartbeat.test.mjs tests/operations-runtime.test.mjs
~~~

Implementation gate: **38/38 PASS** (12 recording-pool/static PostgreSQL contracts, 7 SQLite heartbeat tests, 19 runtime regressions). SQL parsing, migration execution, live RLS isolation, hosted TLS/authentication and deployment certification are **BLOCKED**.
