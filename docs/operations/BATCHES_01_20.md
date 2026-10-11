# Local operations implementation — batches 01–20

## Baseline and boundaries
Baseline 1689353 contained public registration, a pure authorization helper and static pages. The logistics dashboards, durable load lifecycle and workflow engine described in the brief did not exist. Prior wave-0 checklist statements are not evidence for these capabilities.

TLS remediation is preserved in 35976be. Supabase restricted authentication remains blocked (28P01). No hosted database, public registration or consent setting is used by this local operations application.

## Architecture decision
Use the established Node ESM stack and native Node 24.13+ SQLite for an explicitly local, loopback-only workspace. This is durable local implementation, not a hosted database replacement or production certification. No new runtime dependencies. The separate apps/operations directory prevents internal operational content entering site/public.

SQLite transactions cover resource changes, idempotency receipts and append-only audit entries. Active driver/vehicle/load assignment uniqueness is enforced by database indexes. Version checks reject stale commands. Sessions use server-owned principals and explicit role/permission/tenant/relationship checks; passwords use salted scrypt; cookies are HttpOnly/SameSite and mutations require Origin and CSRF checks. Local HTTP is limited to 127.0.0.1 and exact Host. Production identity, HTTPS termination, distributed storage and external integrations require separate design and approval.

## Wave 1 evidence
Batches 01–09: baseline reconciliation; carrier, dispatcher, driver and fleet access; protected branded shell; role-specific operational dashboards; tenant-scoped persisted loads/shipments; carrier-approved equipment; assignment/reassignment; acceptance, pickup, transit and delivery; immutable ownership and audited deactivation.

Batch 10 local gate: npm run verify passed 49 tests, public IP scan and four-page site checks. Core tests cover persistence reopening, full load execution, role and cross-tenant denial, commercial-field isolation, eligibility, stale transitions, idempotency, append-only audit and two-process assignment contention. HTTP tests cover session protection, CSRF, Origin, forged tenant input and revocation. Browser and full Wave 2 evidence follows below.

Hosted certification is BLOCKED. Local validation is not evidence of Supabase or production operation.

## Local operator entry
Run npm run ops:init -- <username> <display-name> <tenant-name>, entering the initial password through standard input (never command arguments or committed files). Bootstrap works only on an empty database. Then npm run ops:start and visit http://127.0.0.1:4180. Data defaults to ignored data/operations.sqlite; IWAY_OPS_DB can select a local file. The service does not load .env.local.

Illustrative fixtures exist only in temporary integration-test workspaces. No default production accounts are created.

## Parking lot — not executed
- Restricted Supabase authentication: 28P01.
- Approved IWAY_CONSENT_VERSION.
- Hosted registration certification.
- Rotation of previously exposed owner password and service-role key.
- Production deployment and hosted integration approval.
