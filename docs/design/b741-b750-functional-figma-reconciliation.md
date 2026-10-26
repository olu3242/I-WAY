# B741-B750 — Figma/Functionality Reconciliation Baseline

Status: **IN PROGRESS — AUDIT ONLY; NOT CERTIFIED**. Tracking issue: #20.

## Verified source hierarchy
- `reference/figma-make-prototype/`: exported Logistics App Design, four personas, in-memory data, not deployable.
- `docs/PRD.md`, `docs/BRD.md`, `docs/brand/tokens/iway-tokens.json`: requirements and authoritative Brand Kit. The old dark/amber prototype theme is superseded.
- Existing application code, protected staging behavior and verified security/tenant contracts take precedence over mock prototype actions.

## Recent integration evidence to reconcile before changing UI
- PR #18 (B721-B740): hosted logistics, offline replay and recovery; local verification reported 909 passing tests; hosted activation remained NO-GO at the reported revision.
- PR #19: responsive staging sign-in, first-load guidance, owner profile switching; reported 115 browser tests and 22 DB-backed browser tests passing. Protected staging was deployed, but real account-holder MFA sign-in and final external UAT were not established by those tests.
- PR #16: governed four-persona onboarding, scoped authorization and isolation, earlier local certification.
These PR descriptions are evidence leads, not proof that all changes are merged into `main`. Inspect their current heads and ancestry before implementing.

## Required screen/capability inventory
For each of Driver Mobile, Carrier Admin, Fleet Company, Platform Admin, record:
| Screen / Figma component | Current route | API / persisted capability | Persona / tenant policy | Responsive viewports | Visual deviation | Functional deviation | Evidence | Priority |
|---|---|---|---|---|---|---|---|---|
| TBD by source inspection | TBD | TBD | TBD | 390px / 768px / 1440px | TBD | TBD | TBD | TBD |

## B741-B750 acceptance tasks
1. Resolve current main, PR #18 and PR #19 ancestry and select approved integration baseline; avoid discarding unmerged behavior.
2. Inventory Figma Make screens and user journeys, with source path and screenshots.
3. Inventory live operations routes, UI components, all four personas and feature flags.
4. Map screen-to-route-to-capability-to-API-to-permission-to-database evidence.
5. Identify newly implemented features absent from Figma; retain them.
6. Compare tokens and shared components to approved Brand Kit; never deploy prototype assets.
7. Capture responsive baseline at 390px, 768px, 1440px with auth-safe synthetic data.
8. Classify each deviation: visual-only, interaction, contract, authorization, missing feature or obsolete design.
9. Prioritize Carrier/Fleet and Driver/Platform fixes for B751-B770; identify cross-cutting B771-B780 items.
10. Publish audit report and exact evidence; do not mark audit or conformity complete without screenshots and current branch tests.

## Release gates
No production deploy, no public reference/docs exposure, no secrets, no mock-success mutation, no bypass of MFA, audit, RLS or owner attribution. Preserve protected staging isolation. No GO claim without hosted E2E and human review.
