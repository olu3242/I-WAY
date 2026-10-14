# PostgreSQL and authorization certification

Local PostgreSQL: PASS, 16/16 (15 subtests plus parent), zero skipped, in b190-postgres-fixed.log. The runner created a disposable PostgreSQL 18 cluster on 127.0.0.1:5433, generated credentials and a one-day local CA, verified TLS identity and restricted NOSUPERUSER/NOBYPASSRLS runtime role, and cleaned up afterward. No existing or hosted database was used.

Verified: all seven tenant tables force RLS; missing/inactive/cross-tenant principals are denied; dispatcher directory is minimal and active-only; actor spoofing in audit/receipts/sessions fails; runtime cannot alter/truncate audit/command evidence or assume fixture admin; all logistics resource kinds deny foreign reads/updates/ownership reassignment; concurrent approval evidence updates have one optimistic winner. Approval business-rule expiry/replay/separation is covered by SQLite domain tests, not claimed as full PostgreSQL workflow parity.

Atomicity: concurrent same-key load creation produces one load/shipment/audit/receipt; conflicting payload fails; injected resource, command and audit persistence failures leave no partial writes and permit a later retry. Twelve concurrent same-key requests completed in 1162.087 ms in this fixture; this is functional contention evidence, not a production throughput gate.

Migration helper applies the existing four Operations migrations under a session advisory lock. Each migration and checksum record commit atomically. Reapplication skips matching checksums and rejects changed checksums; history schema is inaccessible to runtime. It is currently wired only into new disposable fixtures. Existing schemas without this history are not silently adopted; applying to staging requires a reviewed migration history/reconciliation plan.

Attempts retained: initial initdb disk-sync timeout (no security tests ran); second attempt 14 pass / 2 fail counting parent, due to an inconsistent UUID/text parameter in the new negative test; corrected test uses explicit UUID casts and still requires SQLSTATE 42501. Third attempt passes unchanged security assertions.

Hosted B190/B200: BLOCKED. No approved hosted/staging environment, runtime role configuration or complete asynchronous HTTP/session/domain implementation is present for a full journey. Local PASS does not certify hosted behavior. SQLite API/service scoping is not database RLS; only the PostgreSQL fixture supplies RLS evidence.
