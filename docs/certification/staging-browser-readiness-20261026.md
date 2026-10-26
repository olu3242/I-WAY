# Staging browser readiness

Inspection on October 25, 2026 America/Chicago found that the latest successful staging deployment was a schema diagnostic, not the application. A protected request to its /login route returned HTTP 404. The later onboarding diagnostic intentionally failed its build when prerequisites were absent.

The hosted handler now renders a responsive, keyboard-accessible unavailable page for browser entrypoints when runtime initialization fails. Retry sign-in, return-to-staging and expandable help controls use native HTML. A generated request reference supports troubleshooting. API and POST failures retain HTTP 503 JSON; no failed request is presented as a successful login, and no synthetic business data is served.

Added browser coverage at widths 320, 390, 768 and 1440: overflow, keyboard retry, navigation, help expansion, JavaScript errors and axe accessibility checks. Local browser installation failed because the browser download was unavailable; these browser tests must run in CI. Repository verification and targeted handler tests are recorded in the execution response.

The application package must remain protected and Preview-only. Real user/tenant bindings and activation remain outstanding. UI availability is not hosted workflow certification.
