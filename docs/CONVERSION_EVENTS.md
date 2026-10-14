# Conversion event specification (public site)

Events are pushed to `window.dataLayer` and dispatched as a DOM `CustomEvent("iway:track")` by `site/public/assets/js/site.js`. The site sets **no cookies** and sends **no personal data** in events (no names, emails, free text). Session storage holds an unsent form draft only.

Funnel: Visitor → Understand value → Build trust → Get Started → Early access submitted → (later) Account created → Onboarding.

| Event | Fires when | Parameters |
|---|---|---|
| `cta_click` | Any element with `data-cta` is activated | `cta_id` (`get_started`, `explore`, `sign_in`), `location` (`header`, `hero`, `final`, `signin`, `contact`) |
| `nav_click` | Primary in-page nav link | `target` (section id) |
| `section_view` | A section is 35% visible, once per page view | `section` |
| `faq_toggle` | FAQ item opened | `question_index` (1–8) |
| `signup_form_start` | First input in the early-access form | `form` |
| `signup_field_error` | Validation fails | `field` (`name`, `email`) |
| `signup_submit` | Valid submit attempted | `form`, `role` (choice only) |
| `signup_success` | Accepted by the endpoint, or preview success | `form`, `mode` (`live`, `preview`) |
| `signup_error` | Network or server failure | `form`, `reason` (short code) |
| `signin_portal_select` | Portal card chosen | `portal`, `available` (boolean) |

All events also carry `page` (file name). Primary conversion: `signup_success` with `mode=live`. Micro-conversion: `cta_click` with `cta_id=get_started`.

Rules: consent and regional privacy requirements must be confirmed before connecting any analytics vendor [TBC OQ-10]; never add event parameters that contain user input; `mode=preview` events must be excluded from reporting.
