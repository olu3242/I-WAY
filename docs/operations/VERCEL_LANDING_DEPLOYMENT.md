# Vercel landing-page deployment — 2026-10-11

User authorization: deploy the exact page served at http://localhost:4174/early-access.html and include the brand logo.

## Deployed artifact
- Public URL: https://i-way.vercel.app
- Exact page URL: https://i-way.vercel.app/early-access.html
- Deployment: https://i-ctxsz92d5-eduradiusllc.vercel.app
- Deployment ID: dpl_39w3hfU3RhAdMTPVmA7ddRPKkoGg
- Existing project: eduradiusllc/i-way; target production; status READY.
- Source: C:/Cdev/I-WAY/pkg/site/public only. The differing I-WAY-app public copy was not used.
- Root route serves early-access.html. Linked index/contact/sign-in/privacy/terms pages and public assets are retained.
- Selected HTML SHA-256: a97b681a1c8938f91a7b391d38254d2bdab9194b2e5f822f0db16b8b2940b5a3.
- Unmodified logo SHA-256: 194f6d30e18998c37fda202cef6fd5b5ec1eb10f785179df3d77e323df4a8af4.
- Uploaded artifact: 13 public files, 100595 bytes, no server functions.

Vercel Build Output API version 3 was used from isolated dist/landing-release/.vercel/output. Only static public artifacts were deployed using vercel deploy --prebuilt --prod. The runtime configuration retains an empty signup endpoint, empty portal/support configuration and honest preview mode. No environment file, database credential, internal document or prototype was uploaded.

## Small behavioral correction
The preview form claimed nothing was stored but previously saved draft input in sessionStorage. site/public/assets/js/site.js now clears legacy preview drafts and does not restore or save preview input. The selected HTML, CSS, visual design and official logo were unchanged. No sign-up backend or consent version was activated.

## Verified
- npm run verify: build 6 pages; IP scan 13 public files / 41 terms PASS; site check 6 pages PASS.
- Anonymous HTTPS root and early-access page: HTTP 200 with exact selected HTML hash.
- All 13 public files: HTTP 200 and exact package hashes, including SVG logo.
- Private/internal paths, environment file path and local QA artifacts: HTTP 404.
- Real Chromium at 1440 and 390 px: both header/footer logos loaded, no horizontal overflow, keyboard skip link and mobile menu work, no page/console errors.
- Synthetic preview submission: no POST requests, no session draft, preview confirmation only; reload clears entered values.
- Deployed desktop/mobile screenshots visually inspected after scrolling through reveal sections.

Local evidence remains in ignored dist/landing-release: selected-page.json, asset-manifest.json, http-verification.json, qa/local-results.json, qa/deployed-results.json and screenshots. Deployment packaging and QA scripts are there as well. No Git push was performed; pre-existing untracked repository files were preserved.

## Remaining scope
This is publication of the static preview website, not hosted operational or registration certification. Signup, portals and support address remain unconfigured. Privacy and terms pages remain visibly marked draft placeholders. Existing contact copy refers to the early-access form reaching the team even though this deployment is preview-only; revise that copy or connect an approved service before treating it as an operational contact channel. No legal approval is implied.

The application's separate credential, consent, persistence, model and operational release gates remain unresolved.
