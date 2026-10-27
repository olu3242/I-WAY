# I-WAY first-value walkthrough

Internal recording plan. Target: 4 minutes 30 seconds. This is not a released video or hosted certification.

## One outcome

A load created, validated, assigned to an eligible driver/vehicle, then accepted by that driver. The `First load guide` reads the same authorized application state as the operational views. It does not seed records, bypass onboarding, approve equipment, impersonate a driver, or treat an offline queued command as acceptance.

Entry: sign in to the private application, then select **Start guided dispatch** or **First load guide**. Create a guided load or select a visible existing load. Use the existing validation and assignment controls. The driver uses their own account, chooses the assigned load, and accepts. Dispatch selects **Check progress**. Cancellation/reassignment removes the completed acceptance indication on the next successful refresh. Refresh errors mark the guide “Progress needs verification” and label checklist values as last confirmed. The acceptance success heading returns only after a successful refresh still confirms acceptance; navigating between views does not clear the warning. It is not a live feed. Reloading clears the selected guide; choose the visible load again.

## Recording prerequisites

- Use an isolated staging or disposable local environment with clearly labelled illustrative data. Do not use customer data or production identities in recordings.
- Prepare one carrier, a responsible dispatcher, one approved driver and vehicle, and the invitation flow. The application supports invitation-based setup; do not describe it as open self-service registration.
- Show required MFA. Exclude passwords, invitation tokens, authenticator codes, email addresses, and other credentials from the published edit. Starting the recording after an invitation opens is acceptable if captioned accurately.
- Capture the complete uncut elapsed time separately. “Under 60 seconds” is a demonstration target, not a customer speed claim. If setup/waiting exceeds the target, disclose edits and actual elapsed time.
- Record the actual screens from the tested revision. Do not replace application results with animated success badges.

## Recording script and screen cues

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00–1:00 | Invitation setup, required sign-in verification, Start guided dispatch, create, validate, assign, driver acceptance | “Here is one load moving from setup to driver acceptance in I-WAY. We are using a prepared demonstration fleet and illustrative shipment details. After account setup, I create the load, review and validate it, then assign an eligible driver and vehicle. The driver reviews the assignment and accepts. Dispatch checks progress: load assigned, driver accepted.” |
| 1:00–1:40 | Guide checklist beside the actual load | “The essentials are the job details, a clear assignment, and driver confirmation. Each step has a visible status. Assignment alone is not acceptance; the driver confirms it through their own account.” |
| 1:40–2:40 | Same illustrative San Antonio-to-Austin load, assignment and recorded milestones | “Let's follow the same load. The pickup is in San Antonio and the delivery is in Austin. Dispatch can open the job and review its assignment. The driver sees the work they are responsible for and submits the next supported progress update.” |
| 2:40–3:50 | Loads, assignment detail, driver workflow | “Daily work comes down to what needs moving, who is handling it, and what needs attention. Find the load, review the assignment, and check the recorded progress. These are the everyday actions we are focusing on.” |
| 3:50–4:30 | Server-confirmed accepted load, then a simple closing card | “We started with a new load and followed it through driver acceptance. Want to see how this could fit your dispatch workflow? Comment I-WAY to request a pilot walkthrough.” |

Use an on-screen “Illustrative demo” caption throughout the synthetic scenario. If the opening sequence takes more than 60 seconds, shorten narration elsewhere to keep the total below five minutes; do not imply the actual onboarding was faster.

## Evidence and claims

- Real examples: use the actual recorded synthetic journey, labelled illustrative. Replace it with a real job only with permission and verified records.
- Conversations: no unified inbox or customer conversation is implied by this walkthrough. Show actual supported load/assignment activity.
- AI: no live prompt/tool demonstration is included. Existing advisory views must not be portrayed as model-generated actions. Public agent mechanics also require disclosure review under AGENTS.md.
- Reviews: no approved customer reviews were supplied. Omit the testimonial segment. Add a real review only with approved attribution and permission recorded in the disclosure review.
- CTA: the checked-in public configuration has an empty earlyAccessEndpoint. Use the comment-based CTA above until a working approved destination is available. This task does not post or send any messages.

## Validation

Run `npm run verify` and `npx playwright test tests/browser/first-value.spec.mjs` for targeted validation. For the complete discovered-control gate, run `npm run test:browser` followed by `node scripts/report-mvp-coverage.mjs`. The guide tests attach verified control outcomes only after assertions confirm the corresponding visible result and, for acceptance, the persisted load state. A passing targeted suite alone does not establish complete control coverage. The new browser scenarios cover creation through driver acceptance at 390 and 1440 pixels, revocation of acceptance on unassignment, tenant-scoped selection, failed refresh, and invitation setup with carrier MFA through driver acceptance. Browser timings are automated fixture timings, not human onboarding benchmarks. Tests use disposable SQLite and synthetic provider behavior; hosted PostgreSQL/OAuth and actual invitation delivery require separate execution.

Automatic deployment is disabled for `work/first-value-demo-20261025`. Public site files, production services and existing authorization rules are unchanged.


## Durable first-value regression

`tests/browser/first-value-persistence.spec.mjs` creates and assigns a new illustrative load through the integrated application, signs in as its driver, accepts it, reloads the application, and checks acceptance from both driver and carrier accounts. It runs at 390 and 1440 pixels.

The ordinary browser run uses disposable SQLite and labels that scope explicitly. The `durable-browser` CI job also runs this file with `IWAY_BROWSER_DURABLE_OPT_IN=true`, using the existing disposable PostgreSQL fixture. That variant restarts the actual fixture database and recreates the application before checking the unchanged accepted load version. No live database, OAuth provider or production deployment is involved. Review the CI result for the exact commit before calling this restart coverage passed.

## Staging connection diagnostics

Before hosted recording, run the read-only preflight against a private, untracked environment file:

```sh
node scripts/uat-handoff-preflight.mjs /absolute/path/to/private-staging.env
```

The JSON report identifies each required database variable and reports fixed error codes without printing connection strings, passwords, hosts supplied by the operator, or raw parsing errors. In particular, an HTTPS Supabase API URL produces `API_URL_INSTEAD_OF_POSTGRES_CONNECTION`. The three connections require their respective provisioned restricted roles. Session-pooler usernames append the project reference; use port 5432. Store real values only in the isolated iway-auth-staging project's Preview environment.

`FORMAT_VALID_ONLY` means the connection string has the expected shape. It does not establish that the role exists, that its password works, that grants or schema are correct, or that hosted access is certified. The authoritative runtime validators still determine the offline configuration verdict. No database or provider request is made by this command.
