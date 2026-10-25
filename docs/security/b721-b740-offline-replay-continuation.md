# Hosted offline replay continuation — 2026-10-25

Starting SHA: `8acaa6247b513675274c59d41f88574606c0537a`.

## Changes

The driver service worker previously used `cache.addAll` for protected recovery assets. Authentication redirects could therefore cache sign-in HTML under an offline JavaScript or stylesheet path. Installation now fetches the fixed static allowlist with redirects rejected and HTTP caching disabled, verifies success and expected MIME types for every response, then writes the validated response set. Cache version v3 replaces the previous shell during successful activation. An unsuccessful installation does not activate the replacement worker. APIs, authentication routes, load data and personalized pages remain excluded.

The shared hosted HTTP logistics scenario now executes driver acceptance, pickup and transit through `/api/ops/offline`. Each command receives a matching authenticated receipt and its duplicate receives the same receipt. Cross-tenant, crossed-actor, changed-authority and offline-delivery envelopes are rejected. Platform, carrier and fleet personas cannot obtain driver offline context. Delivery remains an online-only command.

After the PostgreSQL fixture restarts, the scenario replays the previous transit envelope and verifies that delivery remains final and each driver status action has exactly one successful audit entry. Existing write-failure rollback and retry checks remain enabled. These checks use synthetic identities and a disposable cluster, not live accounts or hosted PostgreSQL.

## Boundaries and evidence

Two service-worker regression tests cover successful static installation and rejection of redirects, sign-in HTML, missing content types and failed responses before opening the cache. The expanded HTTP scenario passed locally. Full local validation and current-commit remote results are recorded in PR #18.

The starting commit's Verify, PostgreSQL and general browser CI jobs passed; its durable-browser job was still installing Chromium during inspection. Those results do not certify the new revision. Local actual PostgreSQL/browser execution is unavailable in this container, so current-commit CI remains required.

No deployment, hosted migration, credential change, real-user action or invitation was performed. Public deployment isolation remains in place. Hosted activation stays NO-GO pending actual runtime/schema readiness, approved identities/relationships/MFA, provider configuration, confidential onboarding delivery and protected Preview end-to-end validation.

Fresh local `npm run verify`: 905 passed, zero failed/skipped; syntax, public build, IP scan and site checks passed. `git diff --check` passed. Prior-head general browser log confirmed 97 passing cases; current-head browser certification must be checked separately.
