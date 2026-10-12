# Blockers

| Blocker | Impact | Owner | Safe next action |
|---|---|---|---|
| Repeated unchanged performance gate failed | B189 and aggregate production NO-GO | Application/performance owner + test-host owner | Use final repeated measurements; isolate CPU/memory/storage contention and rerun unchanged workloads on a controlled host |
| No approved p99 acceptance budget | p99 measurements cannot be certified against an invented limit | Performance/product owner | Review measured p99 and operational expectations; explicitly approve a separate future budget |
| Hosted PostgreSQL environment/role and complete asynchronous operational adapter unavailable | B190/B199/B200 hosted BLOCKED | Platform/database owner | Provide approved isolated staging, tenant-scoped runtime role, TLS and migration authorization; implement full session/domain parity before hosted journey |
| Approved live provider contract/configuration absent | B197/B198 live BLOCKED | Integration owner | Select approved provider and receipt/callback protocol; supply scoped staging credentials through approved secret handling |
| Legal consent/version and live notification activation not approved | B196 live BLOCKED | Product/legal/communications owner | Approve policy and consent language separately; preserve local-only mode |
| Human release/accessibility review unavailable | Production certification cannot advance | Release owner + accessibility reviewer | Review evidence and manual screen-reader/zoom/touch checks; no deployment implied |

Initial PostgreSQL fixture initialization timed out while syncing new data files. Initial full verification passed 397/398 and failed the measured recovery gate. Isolated recovery passed all checks at 1986.5056 ms. Retain these failures even if later reruns pass; final test-matrix records the actual outcome of each attempt.
