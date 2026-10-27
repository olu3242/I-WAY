# Staging verification follow-up — 2026-10-26 UTC

Source baseline: 2622a32856eb3d34dcc51142aaf98efaedaf8eda, draft PR 19.

GitHub run 40249542755 confirmed that all 12 broker installer checks passed, including the managed bootstrap membership matrix. Durable browser verification passed. The disposable PostgreSQL job passed operations, authentication, broker and durable-engine suites, then failed with asynchronous activity after the onboarding management test ended: `terminating connection due to administrator command`. All ten onboarding assertions had passed; the later hosted HTTP restart step was skipped.

The fixture previously awaited Pool.end() before restarting PostgreSQL. The installed pg-pool implementation removes clients from its collection before their sockets finish closing, allowing Pool.end() to resolve too early. Fixture pools now track client end events and drain all tracked sockets before restart or shutdown, including clients removed after intentional SQL failures. Unexpected database errors are not suppressed.

Vercel metadata reinspection confirms IWAY_AUTH_ENABLED and IWAY_UAT_ENABLED remain absent in Preview. The live schema diagnostic from the preceding execution remains valid evidence of schema readiness only. Hosted activation, provider sign-in and tenant workflow certification have not been performed by this follow-up.
