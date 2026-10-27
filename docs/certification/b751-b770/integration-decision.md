# B751–B770 integration decision

Tracking: [Issue #20](https://github.com/olu3242/I-WAY/issues/20).

The original worktree remains at b1e39bb6c1ada7e91f6fa1d5e35807842238aa85 with its existing changes untouched. New branch: work/b751-b770-harmonization-20261026. Integration base: PR #19 at 893f7f56d39d3e1a46c8bddadb71265216b30ae1, which includes PR #18 at a2090b9d8ad70329eb2412a1af4befbac241b918. No upstream PR was merged or modified.

Local commits 5871dc168ff6f26bf1244a027f63d4fa0d19d92b, 864b19980515a3b3ad74d83df39ac670c074d08c and b1e39bb6c1ada7e91f6fa1d5e35807842238aa85 were applied as a reviewed working patch. Five rejected source/artifact hunks were resolved explicitly: ops.js, ops.css, inventory-mvp-controls.mjs, integrated-workspace.mjs and the generated MVP inventory. Original rejections remain in ignored local evidence. No reset, forced checkout, bulk staging or automatic branch merge was used.

- Keep PR #18 hosted initialization, offline shell/cache and failure recovery.
- Keep PR #19 owner-profile handler, MFA enrollment, current membership checks, cookie/CSRF rotation, read-only cross-scope verification and owner-attributed audit.
- Route both normal and guided load creation through the four-step server-draft wizard. Preserve the newer first-load progress/stale markers, update the guide only after the confirmed wizard receipt, and retain definite-vs-ambiguous command failure handling.
- Keep the approved expense/reimbursement lifecycle, six pay models, documents and PDFs. The authorization, expense, settlement, load-wizard, driver-pay and offline-replay domain modules match the accepted local commit after LF normalization.
- Union inventory source sets and browser fixture options; preserve both the hosted HTTP lifecycle handler and platform capability fixtures.
- Carry only selected current brand assets/tokens, display text and the previous image-path safeguards. Do not rewrite historical evidence with a global brand replacement. The entire original 136-file candidate is copied and hashed under dist/b751-b770/preserved-origin for preservation verification.

The draft PR will be stacked on work/first-value-demo-20261025 so the reviewed PR #18/#19 implementation is preserved without merging either PR into another branch. The PR must remain a draft.

Live read-only project metadata: public i-way has Git creation enabled; isolated iway-auth-staging has Git creation and repository dispatch disabled, with SSO for all deployments. Both use main, no root override and no ignored-build command. The new head branch is explicitly deploymentEnabled:false in root vercel.json; the isolated deployment config also disables Git deployment. Existing GitHub workflows run local/disposable checks, not deployment for this branch. No hosted settings, protections, users, invitations, secrets, billing or deployments were changed.

Unsupported tenant provisioning, fleet dispatch authority, sensitive uploads, seven-agent aliases and original Figma image comparison remain explicit blockers. Do not reinterpret local fixtures or PR descriptions as hosted certification.
