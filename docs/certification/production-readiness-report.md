# B245–B256 production readiness report

## Git and scope
Branch: feat/iway-b245-b256-hosted-evidence-closure.
Worktree: C:/Cdev/I-WAY/pkg/.worktrees/b245-b256.
Baseline commit: 351f1527500a71ef5b4626d4815a05330d8f14c9.
Implementation commit: 8493d799b2fc2bad115b2bc2281fd5c8f8b431c6.
A subsequent evidence-only commit contains this report and immutable log copies. No push, merge, deployment, credential rotation or hosted access was performed. Original worktree changes were not incorporated or modified.

## Verification
| Gate | Baseline | Final |
|---|---|---|
| Application verification | 496/496 PASS | 531/531 PASS, 0 failures/skips |
| New B256 focused tests | absent | 35/35 PASS |
| Browser E2E | 16/16 PASS | 16/16 PASS, 0 failures/skips |
| Accessibility automation | PASS | 57 axe scans, 0 violations |
| Performance | PASS | PASS, unchanged thresholds |
| Recovery | PASS | PASS; observed RPO 656 ms, RTO 400.9947 ms |
| Evaluation | PASS | 12/12 PASS; 0 model inferences |
| Canonical public target | PASS | PASS |
| Isolated identity/integration/PostgreSQL scenarios | executed separately | PASS; PostgreSQL suite 16/16 |
| Aggregate certification validation | VALID | VALID |
| Release check and validation | conservative | VALID; PARTIAL / NO-GO |

Commands executed, with exit checks: npm ci --ignore-scripts; focused node --test; npm run ops:certify; npm run ops:certify:validate; IWAY_OPERATIONS_LOCAL_OPT_IN=1 node scripts/certify-isolated-scenarios.mjs; node scripts/certify-isolated-scenarios.mjs validate; npm run ops:release:check; npm run ops:release:validate; offline evidence CLI dry-run. No standalone lint/typecheck/build commands are defined by this package. Site checks and public-target verification cover the existing static output; no public files were changed.

## Evidence
Final source fingerprint: 9d42b324a77ce068b6c495243cf197aa76ed8eb4f83796e27dd7add2bab79fd5.
Generated originals: dist/operations-evidence/. Byte-preserved committed archive: docs/certification/b245-b256-evidence/. Baseline manifest: docs/certification/b245-b256-baseline/certification.json (historical summary, not current-source evidence).

Key artifacts: certification.json, isolated-scenarios.json, hosted-intake.json, release.json, remediation.json, local-remediation-evidence.json, browser-evidence.json, performance.json, recovery.json, evaluation.json and their actual runner logs. No generated hashes were edited. The certification baseCommit denotes the pre-implementation base; sourceHash binds the tested working-tree content, including the implementation files.

## Implementation and batch results
See b245-b256-gap-matrix.md for exact canonical definitions and existing capability mapping. B245–B253 and B255 reuse passing local engineering; B254 now has a signed, scoped, revocable attestation intake path but no actual credential rotation is claimed. B256 adds artifact verification, pinned signature trust, lifecycle, SQLite concurrency/idempotency, external checkpoint release gating, safe operator intake and seven scenario assertion harnesses. All B245–B255 hosted closures remain BLOCKED pending independent evidence. Existing LOCAL_GATE_EVIDENCE_ONLY, LOCAL_FIXTURE_RECORDED, PARTIAL and NO-GO semantics are preserved.

| Hosted scenario | Local implementation/test | Actual hosted execution |
|---|---|---|
| Identity | Typed MFA/binding/revocation assertions PASS; existing identity tests PASS | NOT EXECUTED |
| Registration | Typed consent/restricted-role/receipt assertions PASS; existing local registration contracts PASS | NOT EXECUTED |
| Persistence | Typed commit/restart/readback assertions PASS; disposable PostgreSQL PASS | NOT EXECUTED |
| Isolation | Typed own/foreign/mutation assertions PASS; disposable RLS PASS | NOT EXECUTED |
| Workflow | Typed lease/restart/fence/completion assertions PASS; existing workflow tests PASS | NOT EXECUTED |
| Integrations | Typed signed/replay/retry/dead-letter assertions PASS; local integrations PASS | NOT EXECUTED |
| Rollback | Typed artifact/restore/health/audit assertions PASS; local recovery PASS | NOT EXECUTED |

These harnesses expose reviewed server-adapter contracts. The CLI has no installed hosted transport; implementing a deployment-specific composition against approved infrastructure remains necessary before actual hosted execution. Cryptographic fixture tests do not count as observed hosted scenarios. Hosted execution: 0/7.

## Security and accessibility
Closed the source-fingerprint omission for lib, migrations and execution. New adversarial tests cover malformed schemas, changed hashes/bytes/signatures, self-approval, unknown signers, wrong scopes, expired/revoked approvals, duplicates/replay, sensitive input, traversal/symlinks, simultaneous revisions, invalid/terminal states, missing prerequisites, failed observations and incomplete rollback coverage. Trusted roots and ACLs must be installed by an authorized operator; no real trust keys were invented.

Automated accessibility found zero violations. Axe reported incomplete color-contrast checks in some views; manual contrast and assistive-technology validation remain pending. No full WCAG conformance claim is made.

## Decisions and exact external next steps
Local executable gates: PASS. Local certification: PARTIAL. Hosted certification: NO-GO. Production: NO-GO.

1. Independently approve the exact non-production tenant, source/Git binding, synthetic fixtures and allowed operations. Provision restricted identity/database and approved consent; obtain credential-rotation attestation without placing credentials in evidence.
2. Install administrator-controlled Ed25519 public-key policy, scopes and revocations outside intake storage; pin it out of band. Obtain signed prerequisite artifacts and scoped execution authorization.
3. Implement and review deployment-specific server transport composition using the fixed seven harness contracts; enforce endpoint restrictions, synthetic-only behavior, cancellation and no real delivery. No arbitrary endpoint or adapter code may come from evidence input.
4. Run authorized hosted scenarios and preserve actual observations and signed attestations. Import artifact bytes, validate, independently review and accept each record. Retain the latest ledger checkpoint independently.
5. Complete manual accessibility, hosted security/provider/operational review and isolated rollback rehearsal. Only then obtain separate security and explicit production release approvals. No deployment follows automatically from this report.
