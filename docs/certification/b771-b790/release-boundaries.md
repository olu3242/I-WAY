# B771–B790 integration and release boundaries

The implementation branch is `work/b751-b770-harmonization-20261026`, isolated from the original dirty worktree. PR #19 remains draft at `893f7f56d39d3e1a46c8bddadb71265216b30ae1`, includes PR #18 at `a2090b9d8ad70329eb2412a1af4befbac241b918`, and is the intended base of this draft PR. Neither upstream PR is merged by this work. B751–B770 was reviewed and committed locally as `4d35fc6b7d005483bd39b657c812adf4a604185f` before this follow-up began.

The original worktree at `pkg/.worktrees/b561-b580-external-uat` retains all 136 snapshotted candidate files without modification. The snapshot and verification are local ignored artifacts, not a second staged copy of user edits. Selected brand assets were copied unchanged; historical branding edits were left in place.

A fresh read-only Vercel metadata review confirms both projects use `main`, neither has a root override or ignored-build command, staging Git deployment creation is disabled, and staging SSO covers all deployments. The public project has automatic Git creation enabled. Root `vercel.json` therefore explicitly sets `git.deploymentEnabled:false` for this exact branch and the stacked feature branches, with no matching true rule. This matches [Vercel's documented branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled). Public output remains `site/public`; reference and internal docs are not deployment content. Eligible GitHub workflows run local/disposable checks; no deployment is requested.

The authorized publication is a feature-branch push and draft PR only, stacked on `work/first-value-demo-20261025`. Before publication, verify secret review, regression results, exact branch suppression and unchanged remote base. After publication, inspect both projects for deployments matching the exact head SHA and record the observation; absence at that time is not a permanent guarantee about future settings. No protection settings, bypass credentials, hosted SQL, accounts or billing changes are authorized.

| Remaining gate | Exact next action | Current status |
|---|---|---|
| Original design evidence | Design owner provides canonical Logistics App Design Figma file/version and approved screen exports; retain Brand Kit styling authority | BLOCKED_REFERENCE |
| Global Platform capabilities | Product/security owner approves management API, least-privilege scopes, tenant lifecycle and audit contracts before adding carrier provisioning or tenant readers | BLOCKED_CONTRACT |
| Seven requested agent names | Product/agent owner supplies approved alias-to-tool/owner mapping for MAX, PULSE, CLARA, GUARDIAN, FINN, SAGE, ATLAS | BLOCKED_MAPPING; five current bounded advisory summaries preserved |
| Sensitive capture/providers | Approve storage/access/retention/deletion and external provider contracts before enabling photos, signatures, identity files, location or uploads | BLOCKED_CONTRACT |
| Hosted database | Confirm an exclusively owner-approved I-WAY staging database and authenticated management owner; independently verify actual restricted runtime login, schema, RLS and migrations | BLOCKED; unrelated/public projects must not be inferred as staging |
| Identity and delivery | Reconcile actual approved subjects/canonical UUIDs, role/tenant/fleet/employment memberships, MFA and invitation-delivery owner; approve each provisioning or delivery mutation separately | BLOCKED; local fixtures are synthetic |
| Protected tester entry | Owner approves individually controlled access and revocation before external UAT; keep existing SSO and deployment protection | BLOCKED |
| Hosted candidate execution | Approve the exact deployment/project/Preview target and configuration after prerequisite gates; execute actual four-persona OAuth/password/MFA/workflow/denial/recovery matrix | BLOCKED; no hosted PASS from local results |
| Human accessibility | Execute the accompanying screen-reader/native-dialog/zoom/touch checklist and record results | NOT RUN |

Rollback for these repository changes: retain the unmerged draft, review reverting the two isolated implementation commits on this feature branch, and rerun affected local checks. Do not reset the original dirty worktree. Hosted rollback is not needed for this execution because no hosted configuration or application deployment was performed. Any future hosted activation package must define its own verified target-specific rollback before approval.
