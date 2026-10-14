# I-WAY QA implementation — batches 4–8

## Batch 4: Transactional PostgreSQL adapter
Added `domain/qa-persona-postgres.mjs`: atomic issuance/audit and revocation/audit, parameterized SQL, private-schema access. Requires a restricted backend pool and applied schema.

## Batch 5: Authenticated boundary
Added `domain/qa-persona-auth-boundary.mjs`: verified bearer identity is the sole principal source. Must be wired into existing HTTP routing with CSRF/origin protections where cookies are used.

## Batch 6: QA switcher UI module
Added opt-in `site/public/assets/js/qa-persona-switcher.js`. It is NOT mounted to the public early-access page; only mount in authenticated Platform Admin QA workspace with server-backed API adapters.

## Batch 7: Negative/unit tests
Added adapter rollback and bearer spoofing tests. Run `node --test tests/qa-persona-*.test.mjs`, then the repository's full verification. These tests do not substitute for live PostgreSQL or Playwright certification.

## Batch 8: Certification handoff
- Confirm approved I-WAY Supabase project, provision restricted DB role, apply reviewed schema through migration workflow.
- Adapt QA service to atomic `issue` and `stop` operations; do not combine its older separate saveSession/appendAudit ports in production.
- Wire backend auth, membership lookup, durable session IDs in secure HttpOnly cookies, and original/effective audit attribution.
- Mount the switcher only after authenticated Platform Admin server-side permission check.
- Add browser E2E across Platform Admin, Carrier, Fleet, Driver, with isolation and accessibility checks.
- Preserve registration consent blocker; NO-GO until approval and hosted certification.

## Security caveats
The PostgreSQL adapter is infrastructure code and must not be connected to an untrusted browser. Existing service ports are not atomic; production integration must use the adapter transaction boundary. The UI is an unmounted component, not a functioning deployment.
