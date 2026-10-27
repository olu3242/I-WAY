# B771–B790 human accessibility execution checklist

Status: **NOT RUN**. Automated Chromium/axe and keyboard scripts are separate evidence. The following tests require a human reviewer with a screen reader, browser zoom, touch or speech input. Use synthetic fixture data; do not capture credentials, authentication factors, personal documents or payment data.

Record reviewer, date, browser/OS, assistive technology/version, persona, viewport, expected/actual outcome and issue reference for each result. Do not mark an unavailable hosted persona PASS.

| Persona | Task | Expected observation |
|---|---|---|
| All four | Sign in, read errors, recover; complete own MFA on approved staging only | Named fields and actionable error announced; no application session before required verification |
| All four | Skip to main, traverse menus with keyboard and screen reader | Focus and current location announced; last item reachable; sign-out visible; no trap |
| All four | 400% zoom, user text spacing, 390/768/1440 widths | Reflow and readable controls; horizontal scrolling limited to intentional tables/menus |
| All four | Navigate loading, empty, unavailable and retry states | Pending/unverified data never announced as saved; retry outcome understandable |
| All four | Native confirmation/prompt, cancellation and error recovery | Dialog title, reason and controls announced; cancellation has no mutation; usable focus returns |
| Carrier | Four-step load wizard, invalid amount/date, edit review and confirmed submit | Field labels/error context clear; values retained; exactly one confirmed record |
| Carrier | Resource assignment, document review and settlement approval | Ownership/holds explained; consequential approval is explicit; approved amount is not money sent |
| Fleet | Equipment/service, employment, expense review and driver pay | Own records only; status and stale-revision errors announced; no carrier dispatch authority |
| Driver | Assignment accept/pickup; offline queued action then reconnect; online POD/delivery | Pending queue distinct from server receipt; rejected replay understandable; sensitive proof stays online |
| Driver | Expense correction and reimbursement status | Amount/reasons/history understandable; approved record cannot silently change; payment evidence distinguished |
| Platform | Cases, configuration and failed-load retry | Governance totals require server response; retry and success announced; no tenant operational reader |
| Approved owner | Switch authorized profiles, logout and stale session | Selected persona announced; original owner attribution retained; fresh MFA/current membership enforced |

Required before full accessibility certification: human reading/focus order, real screen-reader announcements, native dialogs, zoom/text spacing, touch/speech interaction and participation by users with disabilities. Axe results alone do not certify WCAG conformance.
