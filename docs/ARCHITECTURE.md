# I-way — Architecture (INTERNAL, proposed)

> Proposed target architecture derived from the master requirements and the v1 rebuild notes. Every technology choice below is a **recommendation pending an ADR**; none is a decision. Never publish this file.

Diagrams (Mermaid source in `docs/architecture/`, standalone render `iway-architecture.svg` / `.png`):

| File | Shows |
|---|---|
| `01-system-context.mmd` | Public zone, four clients, shared API, data services, integrations |
| `02-ownership-hierarchy.mmd` | Platform → carriers → carrier fleet / managed fleet → driver app |
| `03-load-lifecycle.mmd` | Master load status machine |
| `04-settlement-flow.mmd` | Carrier-driver and managed-fleet settlement paths |
| `05-authorization-decision.mmd` | Per-request authorization decision |
| `06-public-private-boundary.mmd` | Separation of public site from internal material |

Render: `npm run diagrams` (uses `@mermaid-js/mermaid-cli`, downloads a headless browser; not required to read the `.mmd` files — GitHub, GitLab and most IDEs render Mermaid directly).

## Principles

1. **One shared API** for all clients (v1 lesson: load and pay rules live in one place).
2. **Modular monolith first**: clear module boundaries and an internal event outbox; extract services only when evidence demands it.
3. **Tenant and relationship checks on every request** (BR-010/011), enforced in the API *and* at the data layer (e.g. row-level security or equivalent).
4. **Audit by default**: append-only audit events for BR-012 actions.
5. **UTC everywhere, carrier time zone for business logic** (BR-016).
6. **Public zone isolation**: `site/public` is a separate deployable with no shared source, secrets or internal URLs.

## Layers

| Layer | Responsibility | Notes |
|---|---|---|
| Clients | Driver Mobile App, Carrier Admin, Fleet Portal, Platform Admin | One design system on the Brand Kit tokens |
| API gateway | AuthN, MFA, device trust, rate limits, request context | Secrets from a manager, never config files |
| Authorization | Role + permission + tenant + relationship + ownership | Policy-as-code; decision logged |
| Domain modules | Identity; Carriers/Fleet/Agreements; Drivers; Equipment; Loads/Dispatch; Execution/Tracking; Documents; Finance; Notifications; Reporting; Cases/Audit | Finance isolated behind its own tests |
| Data | Relational primary store (tenant-scoped), object storage, event outbox, audit store | Choice of engine in ADR-001 |
| Integrations | Maps/geofence, messaging, payments, factoring, ELD/GPS | Adapters behind interfaces |

## Candidate ADRs

| ADR | Question | Inputs |
|---|---|---|
| ADR-001 | Backend language and primary datastore | Proposal lists Node/REST/GraphQL/MongoDB; v1 was .NET/SQL Server; settlement correctness favours strong transactional guarantees |
| ADR-002 | Driver app: native vs. React Native/Flutter | Master requirement: "truly a mobile app"; geofencing, background location, camera, signature capture, offline queue |
| ADR-003 | Tenant isolation mechanism | BR-010/011 |
| ADR-004 | Settlement engine design and fixtures | §12.4, v1 defects |
| ADR-005 | Document and PDF generation (packets, statements, signed BOL) | v1 packet defects |
| ADR-006 | Notification delivery and preferences | Four channels |
| ADR-007 | Hosting, environments, backups, uptime target | v1 outages |

## Prototype relationship
`reference/figma-make-prototype/` is a React + Vite + Tailwind prototype with in-memory state and test accounts. It demonstrates flows only; it has no backend, real authentication or persistence and must not be deployed to users.
