# I-way AI SOP Changelog

All entries describe **committed implementation**, not hosted deployment. Keep this file updated with every SOP change. Release status remains **NO-GO**.

## [B5.1] — RLS contract test correction
### Fixed
- Replaced the overly broad `BYPASSRLS` regex with assertions against the SQL role creation statement, preserving checks for `NOLOGIN NOBYPASSRLS` while ignoring comments.
### Certification
- User-reported B5 baseline: 32/33 tests passed; the single failure was this contract assertion. Corrected suite requires rerun; no pass claimed yet.

## [B5] — Transaction-local database context helper
### Added
- `transaction-context.mjs`: internal transaction-local tenant and actor settings with rollback and connection release.
- `tests/transaction-context.test.mjs`: four mocked transaction tests.
### Known limitations
- Existing repository adapter is not yet wired to the helper; real database RLS and trusted server session verification remain pending.
- B5 tests are committed but not yet reported executed; hosted release remains NO-GO.

## [Unreleased] — API documentation
### Added
- `API.md`: internal function contracts, repository ports, response shapes, permissions, proposed (not implemented) HTTP endpoints, evidence and limitations.
- Change-control rule: document security, schema, API and certification changes alongside implementation.
### Certification
- Documentation committed; no new runtime certification claimed.

## [B4] — Local RLS policy foundation
### Added
- `sql/sop-local-rls.sql`: restricted NOLOGIN/NOBYPASSRLS role and tenant-scoped RLS policy draft.
- `tests/rls-contract.test.mjs`: three static source-contract tests.
### Known limitations
- SQL not applied to a database; custom GUC context is not a standalone authentication mechanism.
- PostgreSQL repository does not yet set transaction-local verified tenant and actor context.
- Local B4 test execution not yet reported.

## [B3] — Private database schema
### Added
- `sql/sop-local-schema.sql`: three private tables, tenant indexes, enabled and forced RLS, revoked public access.
- `tests/schema-contract.test.mjs`: three static SQL checks.
### Certification
- 26/26 SOP local automated tests passed (user-reported).
- No real PostgreSQL execution claimed.

## [B2] — PostgreSQL repository adapter
### Added
- `postgres-repository.mjs`: parameterized knowledge lookup, transactional ticket insert and transition with row lock and audit event.
- `tests/postgres-repository.test.mjs`: six mocked database tests.
### Certification
- 23/23 SOP local automated tests passed (user-reported).
- Real database permissions and concurrency not certified.

## [B1] — Verified-session runtime adapter
### Added
- `runtime.mjs`: verified-session gate, tenant scope recheck, repository ports and fail-closed persistence receipts.
- `tests/runtime.test.mjs`: five tests.
### Certification
- 17/17 SOP local automated tests passed (user-reported).
- Verified-session flags are not yet wired to a production identity provider.

## [Foundation] — Knowledge and support orchestration
### Added
- Fourteen support personas and 26 SOP definitions.
- Access control, approved-article retrieval, intent routing, critical escalation, ticket lifecycle.
- Twelve baseline tests.

## Release gate
Hosted deployment, operational workflow integration, HTTP API exposure, real PostgreSQL RLS certification, accessibility and four-app E2E remain pending. **NO-GO**.
