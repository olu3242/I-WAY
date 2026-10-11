# Reproducible local browser evidence

Date: 2026-10-11. Scope under test: B01–20 convergence plus B21–40 document, billing, customer, intelligence and durable-runtime workflows. Local browser gate: **PASS**. Hosted certification is **BLOCKED** and is not exercised by this suite.

## Executed checks

`npm run test:browser` executed Playwright 1.64.0 against its official Chromium build on Windows / Node 24.16.0. Result: **8 passed, 0 failed, 0 skipped** (final Group B run: 20.6 seconds). Group A previously passed 7/7. Browser APIs were not mocked; each test used the real HTTP application and a disposable native SQLite database, generated through the existing operations fixture. All accounts and operational data were explicitly illustrative.

| Browser test | Executable evidence |
|---|---|
| Carrier, 1440 × 1000 | Sign-in, role navigation, keyboard skip link and visible button focus; named controls, landmarks and no page overflow; screenshot |
| Dispatcher, 1440 × 1000 | Same checks with dispatcher authority and screenshot |
| Driver, 390 × 844 | Same checks on mobile; finance and approval navigation absent; screenshot |
| Fleet, 390 × 844 | Same checks with fleet relationships; finance and approval navigation absent; screenshot |
| Integrated UI journey | Carrier creates → BOL ingest/validation → dispatcher validates/assigns → driver pickup/transit/exception → recommendation/human approval/recovery → recipient acknowledgment/delivery → invoice approval/issue → customer visibility/local notification → explicitly illustrative payment evidence/human reconciliation → measured analytics; durable state assertions |
| Authentication and isolation | Protected-route redirect, rejected password, separate tenant cannot see another tenant's shipment, logout invalidates API access |
| Customer document portal, 390 × 844 | Mismatched BOL rejected, corrected immutable revision validated, customer sees only own shipment and latest validated BOL; direct requests for superseded or unrelated documents return 403; screenshot |
| Wave 4 advisory and runtime journey, 1440 px | Route/risk analysis → capacity proposal → separate carrier approval → dispatcher applies assignment; driver cannot see advisory actions; five-role coordination completes; human policy pause rejects new work, human resumption enables local mapping job; recorded and estimated costs stay separate, savings remain unmeasured; screenshot |

The journey uses real UI interactions across separate browser contexts for carrier, dispatcher and driver. It asserts the displayed recommendation is not model-generated, driver pages omit commercial details, records reach durable delivered, issued and reconciled states, and the pages produce no JavaScript exceptions.

Carrier desktop, driver mobile, customer document mobile and control-tower desktop screenshots were opened and visually inspected. The official logo is unmodified on a white background, orange actions have navy text, and card/text layouts remain readable at the tested widths. Mobile navigation scrolls within its own region. The automated checks include keyboard focus and meaningful label/landmark checks; they are not a complete WCAG or screen-reader certification.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

No development server needs to be running. The suite allocates a loopback port and fresh temporary database per test, then closes and removes its fixture. It does not read `.env.local`, connect to Supabase, use production credentials, or send external communications.

Files:

- `playwright.config.mjs`: one Chromium worker; explicit browser test folder; no retries hiding failures.
- `tests/browser/workspace.mjs`: isolated app/database fixture and meaningful shared browser checks.
- `tests/browser/operations.spec.mjs`: eight persona, integrated-journey, document/customer, advisory/runtime and negative-path tests.
- `package.json` / `package-lock.json`: pinned `@playwright/test@1.64.0` development dependency and `test:browser` script. No runtime dependency added.

Artifacts regenerate under ignored `dist/browser-results/` (screenshots and failure traces) and `dist/browser-report/` (HTML report). These locations contain illustrative fixture data only and are outside the public deployment tree.

The Wave 4 browser test asserts no assignment changes before both human approval and dispatcher application, then verifies exactly one active assignment. Arrival/risk evidence shows the original shipment version and no stale warning before assignment; after assignment, both evidence panels display an explicit warning that the shipment changed and the operator must rerun analysis before relying on it. The regenerated desktop screenshot was inspected and confirms these warnings are visible. Five fixture worker ticks produce five durable advisory decisions and checkpoint 5/completed. The local mapping result preserves live=false and model=null. Governance pause/resume is exercised through the browser; no role or policy gate is bypassed. Cost evidence records 10,000 cents separately from a 2,500-cent estimate; savings remain unmeasured.

The notification worker is explicitly ticked in the local fixture to create durable local delivery records. No real communications or payments occur: payment provenance is local_fixture, and the notification adapter records externalDelivery=false. The customer browser verifies issued and paid invoice status plus local recorded notification labels.

This closes the prior “no available browser” blocker for the tested local baseline. Hosted identity/persistence, real AI inference, integrations, consent and production release are separate, unresolved gates.
