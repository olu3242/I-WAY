# I-way — Mandatory End-to-End Feature Acceptance Contract

Applies to every feature, release (R0–R4), AI agent, workflow and 10-batch execution. This is a release-blocking policy.

## Working-solution rule

Do not claim PASS or complete for a UI shell, placeholder, stubbed endpoint, in-memory-only implementation, unconnected workflow, mock success response or test-only integration. A static informational page may be complete as a static page; any form, signup, account, dispatch, payment, approval or stateful interaction must have its real functional path.

## Required evidence for PASS

1. Working user interface or externally callable interface that performs the intended task.
2. Server-side business behavior through a real API/service.
3. Durable storage and read-back across refresh, restart and new session where relevant.
4. Authenticated, server-enforced tenant, role, relationship and resource authorization; negative cross-tenant tests.
5. Correct state transitions, dependent workflow actions and event delivery where applicable.
6. Auditable records for material actions, including actor, tenant, resource, action and outcome.
7. Input validation, safe failures, idempotency/retry/recovery for external and money-related actions.
8. Executed automated unit/integration/E2E tests with evidence, including failure paths.
9. Deployment and hosted environment checks for features claimed production-ready.
10. Explicit acceptance traceability to PRD/BRD requirements and release gates.

## Reporting states

- PASS: All applicable requirements are implemented and verified with actual evidence.
- PARTIAL: Some working implementation exists but at least one acceptance requirement is unverified or incomplete.
- BLOCKED: Cannot proceed without an external dependency, missing source, credentials, approval or decision; state the blocker and continue independent work.
- FAIL: Tested and did not meet acceptance criteria.
- NOT STARTED: No working implementation.

A batch count is an execution cadence, never permission to relax acceptance gates. No fictional metrics, certifications, screenshots, or success claims.

## Agent execution instruction

Run ten dependency-ready batches per cycle with one consolidated report. Inspect existing code first, avoid duplicate work, implement the complete vertical slice and verify. Never substitute a plan or a shell for functioning code. When infrastructure is unavailable, implement and test what can be verified locally, mark hosted certification BLOCKED, and never promote the feature to PASS.

## Current retrospective correction

Earlier R0 static website build checks do not prove live early-access registration, backend persistence, authenticated sign-in, browser E2E or production readiness. Those capabilities remain unimplemented/unverified until demonstrated. Authorization policy helpers alone do not constitute production authorization.
