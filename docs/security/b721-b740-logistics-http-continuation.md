# Hosted logistics HTTP continuation — 2026-10-25

Starting SHA: `ca37a7e71a8ff7deb0ddffd2713f1e9b6d675ea8`.
Scope: close integration-test coverage gaps, retaining existing production domain and authorization rules. No deployment, live invitation, hosted schema or credential change.

## Implementation

A shared synthetic scenario now executes through the production hosted handler, UAT authentication bridge and Operations HTTP command routes. It signs in all four personas, creates a load, retries creation, validates, dispatches, accepts, picks up, starts transit and delivers. It asserts that fleet and platform users cannot dispatch, an unassigned driver cannot validate, another tenant's resource cannot be modified or listed, missing CSRF is rejected, stale versions conflict, and delivery cannot precede pickup/transit. Final state verifies delivered load/shipment, ended assignment and exactly one creation audit record.

The same scenario runs in a dedicated disposable PostgreSQL CI step. It restarts the actual fixture database, recreates the Operations engine and connection pool, and then checks delivered state, tenant denial and idempotent creation replay. This is not a mock restart. The fixture owns its cluster and never reads hosted credentials.

Shared integrated browser fixtures now also traverse the hosted handler. PostgreSQL fixture restart support closes old pools before restarting and obtains a new restricted connection for the rebuilt application.

## Evidence

- Local `npm run verify`: 899 passed, zero failed/skipped, including syntax, public build, IP scan and site checks.
- New HTTP logistics scenario: passed locally, included in the repository count.
- `git diff --check`: passed.
- Prior SHA remote Verify: success, run 40215140298.
- Prior SHA remote disposable-postgres: success, job 121234545977; Operations 16, authentication 19, broker 7, durable engine 16, management 10 reported tests. Suite counts include nested tests and are not unique workflows.
- Prior SHA remote durable-browser: success, job 121234546311; 16 passed.
- Prior SHA general browser job was still running when this report was written.
- New PostgreSQL scenario and latest remote CI require exact-commit verification after publication. Local PostgreSQL/browser execution remains unavailable in this container; prior commit results do not certify new changes.

Hosted activation remains NO-GO pending actual restricted runtime/schema readiness, approved identities and tenant relationships, provider/MFA configuration, confidential onboarding delivery, protected Preview artifact and real hosted end-to-end certification. PostgreSQL 16 CI is not hosted PostgreSQL 17 parity certification.
