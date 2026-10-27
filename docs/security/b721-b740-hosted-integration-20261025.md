# B721–B740 hosted integration continuation — 2026-10-25

Status: repository regression PASS; hosted activation and production NO-GO.

Branch: `work/b721-b740-hosted-integration-20261025`.
Starting commit: `4d75051002f190b2178c6c88fea0272cfca507f5`.
The implementation revision is the commit containing this report; remote CI results must be checked against its exact SHA.

## Inspected implementation

The starting branch already implements the isolated UAT route adapter, restricted PostgreSQL Operations engine, transaction-buffered HTTP responses, four-persona session bridge, tenant/resource authorization, load creation, dispatch, driver workflows, and separate secure onboarding management capability. This continuation reuses these implementations; it does not claim to have newly implemented or live-certified all of them. Earlier B701–B740 evidence is historical and is not a substitute for this run.

## Changes

- Disable automatic root-project Git deployment for this exact implementation branch while retaining the older UAT branch exclusion and `site/public` output. The source guard and regression test require both exclusions.
- Extract the actual hosted request lifecycle into a server-only injectable handler used by the isolated Vercel adapter. Concurrent cold starts share initialization. Expired or failed generations retire; active requests finish before pools close. New requests obtain a fresh runtime.
- Reject invalid expiry, sanitize synchronous/asynchronous startup failures, tolerate logging failures, and abort partially written responses instead of ending a failed response as apparent success.
- Run existing four-persona HTTP authentication, MFA, session rotation, logout/replay, relationship revocation and tenant-boundary tests through the hosted handler. Update browser lifecycle tests to use that same handler in both native and durable modes.
- Extend GitHub Actions with durable Operations transaction/restart checks, onboarding command custody checks, and a separate durable browser job using disposable loopback PostgreSQL and synthetic identities. These jobs do not read hosted secrets, migrate hosted databases, send invitations or deploy an application. PostgreSQL 16 CI is not PostgreSQL 17 hosted parity certification.

## Fresh local verification

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | PASS |
| `npm run verify` | PASS: 898 tests, 0 failures, 0 skipped; syntax, site build, IP scan and site structure passed |
| Targeted hosted handler, integrated application HTTP, durable HTTP fault tests | PASS: 17 tests; included in repository total, not additive |
| `git diff --check` | PASS |
| Chromium installation / launch | BLOCKED: download returned an invalid ZIP; no installed executable |
| Actual durable PostgreSQL test | BLOCKED: `LOCAL_POSTGRES_BINARIES_REQUIRED`; installer cannot switch users/groups in this container |
| Browser E2E, actual PostgreSQL restart/RLS, live hosted E2E | Not certified by this local run |

Four new handler tests exercise concurrent initialization/expiry, failure draining/recovery, sanitized startup/logging failure, and invalid expiry/partial-response abort. Deployment-policy regression requires every protected branch to be explicitly disabled.

## Remaining NO-GO blockers

1. Successful remote browser and durable PostgreSQL CI evidence for the exact implementation SHA. New CI job definitions alone are not passing evidence.
2. Fresh verification of the isolated Preview project/origin and all required configuration, restricted Auth/broker/Operations runtime logins, TLS, schema/RLS state and approved deployment bindings. Earlier reports describe missing infrastructure; this run made no fresh hosted catalog claims.
3. Approved actual four-user identity, role, tenant/fleet/employment records, Google callback settings and privileged MFA; successful login/logout/revocation and tenant-denial tests on the actual protected deployment.
4. Separate configured onboarding management host, approval source and confidential delivery transport; live approved delivery remains untested.
5. Commit-specific protected Preview artifact verification and actual browser-to-PostgreSQL logistics workflows, recovery and access certification. This task did not deploy Preview or production.

Public source/content, hosted schemas, credentials and identities were not modified. No merge or production deployment is authorized by this report.
