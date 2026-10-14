# I-way Batches 71–80 — Supabase schema reconciliation

Evidence supplied by operator: CLI link to vnoxdinldneeczxibicp succeeded; migration 20261011055816_iway_early_access.sql applied; local and remote histories match.

| Batch | Outcome | Status |
|---|---|---|
| 71 | Supabase CLI project linked | PASS (operator evidence) |
| 72 | Migration applied and history matched | PASS (operator evidence) |
| 73 | Align SQL adapter with private schema | PARTIAL, CI pending |
| 74 | Include consent_version in insert | PARTIAL, legal approval pending |
| 75 | Require server consent version config | PARTIAL |
| 76 | Startup query checks private table visibility | PARTIAL, live connection pending |
| 77 | Update adapter tests | PENDING CI |
| 78 | Update HTTP integration test | PENDING CI |
| 79 | Document server-only environment variables | PASS |
| 80 | Live registration readback / hosted E2E | BLOCKED: runtime database credentials, approved consent version, server deployment |

The current SQL migration lives in the operator's local checkout and was not imported into this branch. Do not create duplicate migrations without reconciliation. The public form remains subject to privacy and consent review.

Before PASS: verify role grants and RLS, configure least-privileged DB role, deploy server, submit test registration and confirm database row via authorized readback, concurrent requests and restart persistence, abuse controls and legal sign-off.
