# Reproducible local browser and accessibility evidence

Date: 2026-10-11. Scope: B01–40 convergence plus B41/B43 operational views and B45/B49 local acceptance. Browser gate: **PASS**. Automated accessibility gate: **PASS** with manual review outstanding. Hosted certification remains **BLOCKED**.

## Baseline and executed results

Before B41–60 edits, the reported baseline was independently reconfirmed: **8 Chromium tests passed, 0 failed, 0 skipped** (24.6 seconds).

The final Wave 5 browser run executed `npm run test:browser` with Playwright 1.64.0 and its official Chromium build on Windows / Node 24.16.0:

- **11 passed, 0 failed, 0 skipped**; actual duration 59.8 seconds.
- **54 axe-core 4.13.0 scans, 0 detected violations**, using unsuppressed WCAG 2.0 A/AA, 2.1 A/AA and 2.2 AA rules.
- Viewports: **1440, 390 and 320 CSS pixels**.
- The existing three client-rendering/replay tests separately passed **3/3**.
- Automated incomplete checks include **color-contrast** and remain visible for manual review; no rules or elements are excluded to make the gate pass.

Each test uses a real loopback HTTP application and disposable native SQLite database. Accounts, customer documents, payment evidence and operational data are explicitly illustrative. One recovery case intentionally drops a browser response *after* the real API has committed; it then verifies a user retry preserves idempotency. Other API responses and domain behavior are not mocked.

## Coverage and changes

| Check | Executable evidence |
|---|---|
| Four baseline personas | Carrier/dispatcher desktop and driver/fleet mobile sign-in, scoped navigation, landmarks, names, keyboard skip link and screenshots |
| All carrier views | Every navigation destination scanned at 1440 and 320 px; no page overflow; heading focus after navigation; correctly associated controls and keyboard-accessible scrolling tables |
| Authentication recovery | Incorrect sign-in announced in a focused alert; controls reference the error; keyboard submission succeeds after correction |
| Fleet acceptance | Fleet creates its own driver and equipment, edits maintenance, deactivates its own employee and never sees another employer's driver |
| Lost-response recovery | Real vehicle creation commits; browser response is intentionally dropped; retry creates exactly one durable vehicle |
| Stale-version recovery | Concurrent fleet change causes a focused error, preserves entered values, and succeeds after reloading current state |
| Core/Wave 3 journey | Carrier creates → reviewed BOL → dispatcher assignment → driver pickup/transit/tracking → exception/recommendation/human approval/recovery → ePOD/delivery → invoice approval/issue → customer visibility/local notification → illustrative payment evidence/human reconciliation |
| Customer documents | Invalid BOL cannot pass review; corrected revision is immutable; customer sees only its own latest validated BOL; superseded/unrelated document reads return 403 |
| Wave 4 journey | Route/risk evidence → separate carrier approval → dispatcher application; driver has no advisory controls; five durable advisory checkpoints; governance pause/resume; local mapping adapter; separate recorded/estimated costs |
| Operational measurement | Carrier records 165.5 user-reported completed miles; analytics displays the evidence and explicitly unavailable ROI/savings |
| Workflow health | Existing runtime view displays scoped counts and actionable local alerts, with no external alert-delivery claim |

Remediation fixes confirmed by regression tests:

- Dynamic navigation now moves focus to the new heading instead of losing keyboard position when elements are replaced.
- Success summaries receive focus after mutations; errors use focused, atomic assertive alerts.
- Sign-in errors are associated with the authentication fields, and corrections clear invalid-field state.
- Carrier account/fleet forms and dispatch/exception forms use distinct input identifiers.
- Overflowing data tables are labelled, keyboard-focusable regions.
- Focus indicators use blue on light surfaces and cyan on dark navigation. Narrow layouts and long content reflow.

Operational metrics, workflow health and completed-distance entry reuse existing tabs. Costs and mileage remain user-reported; missing evidence does not establish zero cost, recommendations do not establish causation, and ROI remains unavailable.

## Reproduce and inspect artifacts

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

The suite starts its own isolated server/database, closes it and removes its fixture. It never loads `.env.local`, connects to Supabase, uses production credentials, sends external communications or moves money.

`dist/browser-evidence.json` is the machine-readable gate output. Schema version 1 records status, exact passed/failed/skipped counts, timings, axe scan counts and incomplete rules, tested viewports, remaining manual checks and SHA-256 hashes for the client/browser-test inputs. The reporter regenerates it on every run; a focused test run reports its smaller scope and cannot stand in for the complete gate.

The HTML report is under `dist/browser-report/`; screenshots and failure traces regenerate under `dist/browser-results/`. Full axe findings are attached to their tests, including incomplete results. These ignored artifacts contain only illustrative fixtures and are outside the public deployment tree.

Relevant files:

- `playwright.config.mjs`: one Chromium worker, no retries hiding failures, evidence reporter.
- `tests/browser/workspace.mjs`: isolated real HTTP/SQLite fixture and shared axe checks.
- `tests/browser/operations.spec.mjs`: eight operational, security and customer/advisory journeys.
- `tests/browser/accessibility.spec.mjs`: three accessibility, authentication-recovery and fleet-acceptance tests.
- `tests/browser/evidence-reporter.mjs`: machine-readable test/audit evidence.
- Development dependencies: pinned `@playwright/test@1.64.0` and `@axe-core/playwright@4.13.0`; no added runtime dependency.

## Accessibility limits

Automated success is **not complete WCAG 2.2 AA conformance**. The machine report deliberately records `manual_review_required`.

Remaining manual checks: incomplete contrast results; NVDA or another screen reader across full tasks/live announcements; meaningful reading/focus order with complex records; 400% browser zoom and user text spacing; touch and speech input; native approval dialogs with assistive technology; and usability with disabled users. The 320 px viewport test verifies reflow at that width, not every browser/assistive-technology configuration.

Carrier desktop, driver mobile, customer documents and control-tower screenshots have been visually inspected. Official branding is unmodified; orange actions use navy text. Historical route/risk evidence displays its timestamp/version and a warning after the shipment changes. No model inference, independently verified GPS, real payment, measured savings or hosted-release success is claimed.

The automated workflow follows the official [Playwright accessibility guidance](https://playwright.dev/docs/accessibility-testing) and the official [axe Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright). Both tooling and this evidence distinguish automated checks from manual accessibility assessment.
