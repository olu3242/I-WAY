# I-way Batches 41–50 — Registration runtime integration

| Batch | Work | Status |
|---|---|---|
| 41 | Verify prior CI at ed2d1268 | PASS |
| 42 | Inject durable store into HTTP registration handler | PARTIAL: integration test uses fake SQL client |
| 43 | Wire PostgreSQL pool to runtime when DATABASE_URL set | PARTIAL: no hosted database configured |
| 44 | Refuse file-backed persistence in production | PARTIAL: runtime not deployed |
| 45 | Health endpoint | PARTIAL: HTTP tested locally in CI |
| 46 | Explicit 503 on persistence failure | PARTIAL: tested using failure injection |
| 47 | Test HTTP-to-PG adapter duplicate semantics | PARTIAL: injected pool, not real PG |
| 48 | Add production pg dependency | PENDING CI |
| 49 | Update CI dependency installation | PENDING CI |
| 50 | Hosted persistent registration certification | BLOCKED: live database, migration, deployed app and browser E2E absent |

Important: A fake SQL pool tests wiring, not PostgreSQL transaction behavior. No production-ready claim is permitted. Remaining: real database test, migration application, concurrency, rate limiting, privacy/legal approval, browser E2E, security review and deployment.
