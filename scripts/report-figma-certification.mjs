// Final report generation refuses failed, incomplete or source-drifted browser evidence.
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const output='dist/figma-gap-closure',docs='docs/certification/figma-gap-closure';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trimEnd();
const browser=read(output+'/browser-evidence.json'),durable=read(output+'/durable-browser/browser-evidence.json'),coverage=read(output+'/mvp-coverage.json'),pg=read(output+'/postgres17-compatibility.json'),requirements=read(docs+'/requirements.json'),secrets=read(output+'/secret-review.json'),performance=read(output+'/performance.json'),recovery=read(output+'/recovery.json'),dependencies=read(output+'/dependency-audit.json');
for(const r of [browser,durable])if(r.status!=='passed'||r.sourceUnchanged!==true||r.counts.failed||r.counts.skipped||r.counts.total!==r.counts.passed)throw Error('BROWSER_CERTIFICATION_EVIDENCE_INCOMPLETE');
if(browser.backend!=='disposable SQLite'||durable.backend!=='disposable PostgreSQL'||coverage.coverageDecision!=='GO_LOCAL_DISCOVERED_CONTROLS')throw Error('BROWSER_SCOPE_OR_COVERAGE_MISMATCH');
if(pg.status!=='PASS'||pg.serverVersion.number!==170011||secrets.status!=='PASS'||performance.status!=='PASS'||recovery.status!=='PASS'||dependencies.metadata?.vulnerabilities.total!==0)throw Error('LOCAL_CERTIFICATION_GATE_FAILED');
const log=readFileSync(output+'/repository.log','utf8'),count=label=>Number(new RegExp('(?:ℹ |# )'+label+' (\\d+)').exec(log)?.[1]??-1);
const repository={tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped')};
if(repository.tests<1||repository.pass!==repository.tests||repository.fail||repository.skipped||!log.includes('Site structure and configured/preview registration contract PASS'))throw Error('REPOSITORY_VERIFICATION_INCOMPLETE');
const scope13=['settlement:create','settlement:recalculate','settlement:adjust','settlement:approve','settlement:unapprove','settlement:dispute','driverpay:create','driverpay:approve','driverpay:unapprove','vehicle:serviceplan','maintenance:record','maintenance:review','load:reject'];
const api=scope13.map(action=>{const control=coverage.controls.find(c=>c.key==='action:'+action);return {method:'POST',route:'/api/ops/commands',action,status:control?.verifiedIn.length?'PASS':'NOT RUN',proofTests:control?.verifiedIn??[]};});
const replay=coverage.controls.find(c=>c.key==='button:Retry queued actions');
for(const [method,route] of [['GET','/api/ops/offline/context'],['POST','/api/ops/offline']])api.push({method,route,status:replay?.verifiedIn.length?'PASS':'NOT RUN',proofTests:replay?.verifiedIn??[],assertions:'The browser ready helper requires authenticated context HTTP 200; replay requires the persisted server transition, one audit and an emptied queue.'});
if(api.some(r=>r.status!=='PASS'))throw Error('NEW_API_CONTRACT_EVIDENCE_MISSING');
const apiReport={scope:'Fifteen new application contracts, including thirteen commands sharing one HTTP endpoint; not all repository/provider APIs',passed:api.length,total:api.length,percentage:100,overallRepositoryApiCoverage:null,providerIntegration:'BLOCKED_REAL_PROVIDER_NOT_ACTIVATED',contracts:api};
writeFileSync(output+'/api-contract-evidence.json',JSON.stringify(apiReport,null,2)+'\n');
function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(directory,e.name)):[join(directory,e.name).replaceAll('\\','/')]);}
const screenshots=[...files('dist/browser-results'),...files(output+'/durable-browser/results')].filter(p=>p.endsWith('.png')).map(path=>{const bytes=readFileSync(path);return {path,sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};});
writeFileSync(output+'/screenshots.json',JSON.stringify({scope:'Current synthetic local screens; no original Figma pixel reference',visualComparison:'BLOCKED_REFERENCE',screenshots},null,2)+'\n');
const hosted=read(output+'/hosted-uat-matrix.json'),manual=read(output+'/manual-accessibility.json'),environment=read(output+'/environment-contract.json');
const reportPath=docs+'/certification-report.md',receiptPath=docs+'/receipt.json';
mkdirSync(docs,{recursive:true});writeFileSync(reportPath,'Certification report generation in progress.\n');writeFileSync(receiptPath,'{}\n');
const changed=git(['status','--porcelain=v1','--untracked-files=all']).split(/\r?\n/).filter(Boolean).map(line=>line.slice(3)).sort();
if(changed.some(p=>/(^|\/)\.env\.local$/.test(p)))throw Error('PRIVATE_ENV_CANDIDATE_REJECTED');
const start='4a1c39b66fd0db383ef430074f9747c359512a2a',branch=git(['branch','--show-current']);
if(branch!=='work/b561-b580-external-uat')throw Error('FEATURE_BRANCH_REQUIRED');
const sections=[
 '# I-WAY — Figma gap closure and local certification',
 '',
 'Covered local workflows: GO. Full four-application conformity: NO-GO / incomplete. Hosted certification and production readiness: NO-GO.',
 '',
 'This is an implementation and verified local regression milestone. It does not complete every P0/P1 requirement. Partial and missing repository work is listed explicitly rather than relabeled as an approval blocker.',
 '',
 'Starting SHA: '+start+'. Branch: '+branch+'. Starting worktree: clean. Ending SHA: the local commit containing this report; the literal ending SHA, clean-worktree proof and artifact checksum are recorded in dist/figma-gap-closure/post-commit-verification.json. No push, merge, deployment, hosted migration, real identity provisioning, invitation, credential rotation, protection or billing change occurred.',
 '',
 '## Implemented modules and fixes',
 '',
 '- Driver status queue: bounded IndexedDB storage, static offline recovery, reload/reconnect, stable replay keys, fresh session/CSRF and current assignment/eligibility checks. Lost-response and concurrent restart replay produce one persisted effect. No documents, signatures, tokens or customer/location data are queued.',
 '- Financial foundation: weekly source-backed settlement calculations, once-per-week deductions, target-capped derived escrow, stale-source rejection, immutable approvals, audited reopening/adjustments and fleet disputes. Fleet-owned per-load driver pay checks live employment and approved settlement budget. Driver earnings exclude carrier commercial fields and carrier-to-fleet statements.',
 '- Assignment and search: driver rejection with reason and replay-safe release; visible-load search and active/completed lists.',
 '- Maintenance: carrier intervals, monotonic odometer reports, driver/owner service history, owner review and due warnings. A fleet cannot clear a carrier out-of-service hold; fleet-private service notes are absent from carrier projections.',
 '- Brand/accessibility: unchanged logo with white chip, locally bundled Inter/license, approved colors/radii, one orange primary action per rendered view, driver primary targets and keyboard queue cancellation focus.',
 '- Confirmed remediation: financial submit state now disables the submit control after adding deduction controls; duplicate submission is explicitly tested. Client/package fixtures include the real added assets. Keyboard browser tests synchronize with enabled controls. Browser evidence binds source hashes at start and end and rejects source changes during execution.',
 '',
 'See [implemented contracts](implementation-contracts.md) for calculation, privacy, ownership and recovery limits.',
 '',
 '## Actual test results',
 '',
 '| Suite | PASS | FAIL | BLOCKED / NOT RUN | Scope |',
 '|---|---:|---:|---|---|',
 '| Repository npm run verify | '+repository.pass+' | '+repository.fail+' | '+repository.skipped+' skipped | Syntax, repository regression, public build/IP/structure gates |',
 '| General Chromium browser | '+browser.counts.passed+' | '+browser.counts.failed+' | '+browser.counts.skipped+' skipped | Disposable SQLite/HTTP and synthetic identity providers |',
 '| PostgreSQL Chromium variants | '+durable.counts.passed+' | '+durable.counts.failed+' | '+durable.counts.skipped+' skipped | Restricted disposable PostgreSQL; overlaps general browser cases |',
 '| PostgreSQL 17.11 | '+pg.leafScenarios+' leaf scenarios | 0 | 0 skipped | '+pg.reportedNodeChecks+' Node checks include eight orchestration parents |',
 '| Performance | 4 scenarios | 0 | No hosted SLO/capacity claim | Unchanged checked-in regression budgets |',
 '| Recovery | 1 rehearsal | 0 | Hosted disaster recovery not run | Backup/restore, audit preservation, session revocation and worker resumption |',
 '| Hosted E2E | 0 | 0 | '+hosted.counts.BLOCKED+' BLOCKED | Zero hosted executions |',
 '| Human accessibility | 0 | 0 | '+manual.count+' NOT RUN | 48 existing and eight added scripts |',
 '',
 'Counts are separate and must not be summed as unique assertions. Exploratory failures are retained in local logs; only the frozen-source final runs above are certification evidence. Synthetic Google/password/MFA results do not certify real hosted authentication.',
 '',
 'General axe scans: '+browser.accessibility.scanCount+', violations '+browser.accessibility.violationCount+'. PostgreSQL browser axe scans: '+durable.accessibility.scanCount+', violations '+durable.accessibility.violationCount+'. Manual review remains required; these scans are not complete WCAG conformance.',
 '',
 'Performance p95 milliseconds: '+performance.scenarios.map(s=>s.scenario+' '+s.latency.p95Ms.toFixed(2)).join('; ')+'. Recovery observed RTO '+recovery.observedRtoMs.toFixed(2)+' ms and RPO '+recovery.observedRpoMs.toFixed(2)+' ms in the deliberate local snapshot-loss rehearsal. Dependency registry audit reports zero known vulnerabilities across '+dependencies.metadata.dependencies.total+' dependencies; it is not a guarantee that vulnerabilities do not exist.',
 '',
 '## Coverage and conformity',
 '',
 'Implemented interaction outcomes: '+coverage.categories.action.verifiedOutcome+'/'+coverage.categories.action.inventoried+' actions; '+coverage.categories.form.verifiedOutcome+'/'+coverage.categories.form.inventoried+' forms; '+coverage.categories.button.verifiedOutcome+'/'+coverage.categories.button.inventoried+' button labels; '+coverage.categories.navigation.verifiedOutcome+'/'+coverage.categories.navigation.inventoried+' navigation entries. No inventoried executable control lacks local outcome evidence.',
 '',
 'The source inventory also contains '+coverage.categories.route.inventoried+' route patterns and '+coverage.categories.field.inventoried+' field names. Only '+coverage.categories.field.interacted+' fields have recorded interaction evidence. Route discovery is not HTTP-method/resource coverage, and form/action coverage does not certify all input permutations.',
 '',
 'New application API contract coverage: '+apiReport.passed+'/'+apiReport.total+' (100%) for the explicitly enumerated thirteen command actions plus offline context/replay. Overall repository/provider API integration percentage is not certified. See dist/figma-gap-closure/api-contract-evidence.json.',
 '',
 'Four personas execute persisted/keyboard workflows at 320, 375, 390, 768, 1024 and 1440 pixels. '+screenshots.length+' screenshot artifacts are recorded in dist/figma-gap-closure/screenshots.json. Selected 320-pixel Platform, Carrier and Driver screenshots were visually inspected; that inspection does not substitute for all-screen comparison.',
 '',
 'Figma functionality conformity percentage: NOT CERTIFIED. Visual conformity percentage: BLOCKED_REFERENCE, no percentage calculated. The canonical original Make file/version and original exported screen images are unavailable. Checked-in prototype flows and Brand Kit tokens are used; legacy dark/amber styling is superseded.',
 '',
 'Strict whole-PRD-row review: '+requirements.counts.IMPLEMENTED_LOCAL+'/'+requirements.total+' locally implemented rows ('+requirements.strictCompleteRequirementRatio.percentage.toFixed(2)+'%); '+requirements.counts.PARTIAL+' partial, '+requirements.counts.MISSING+' missing, '+requirements.counts.BLOCKED_DECISION+' blocked by a sensitive/native decision. Compound partial rows receive no whole-row credit. This conservative PRD ratio is not a Figma similarity or feature-completion percentage. See the complete [gap register](gap-register.md) and [machine-readable trace](requirements.json).',
 '',
 '## Remaining implementation and blockers',
 '',
 '| Type | Remaining item | Exact next action |',
 '|---|---|---|',
 '| Repository work, P0/P1 | Full load wizard/directories and status-aware corrections; fine-grained arrival/loading; driver expenses; full onboarding/profile/typed document flows | Continue those modules against their individual PRD rows, with human/tenant/financial gates retained. They are not marked externally blocked solely because code is absent. |',
 '| Repository work, P0/P1 | Remaining fleet pay models, vehicle-sourced terms, pay-week navigation/moves, financial summaries, statement PDFs and full escrow ledger | Implement/review missing contracts and negative tests; obtain OQ-02/OQ-04/OQ-05/OQ-06 decisions where relevant. |',
 '| Repository work, P0/P1 | Full platform tenant/staff/case/configuration workflows and reason-bound support/audit grants | Implement a reviewed management-plane contract; do not grant implicit operational cross-tenant authority. |',
 '| BLOCKED_DECISION | Native/background location, geofencing and secure offline photos/signatures | Resolve ADR-002/OQ-11 and sensitive evidence storage/retention OQ-08. Keep collection disabled until reviewed. |',
 '| BLOCKED_REFERENCE | Original screen-by-screen visual comparison | Supply the original Logistics App Design Figma link/version and exported screens. |',
 '| BLOCKED_OWNER_TARGET | No exclusively approved I-WAY staging database, management owner or invitation delivery owner | Owner designates target and owners; retarget/review runtime pins, SQL packages and A03–A09 before any activation. Public early-access and Velocity databases are excluded. |',
 '| BLOCKED_APPROVAL | Environment, migrations, real identities/MFA, invitation delivery, protected Preview and external access | Resolve exact A01–A12 actions as applicable; no inferred approval and no deployment-protection bypass. |',
 '| NOT RUN | Human assistive-technology, native-dialog, zoom/text-spacing, touch/speech and real-device validation | Execute the 56 prepared scripts with recorded reviewer/device/browser/AT versions and defect evidence. |',
 '',
 'The legacy local environment is not an approved staging runtime: '+environment.localPresent+'/'+environment.requiredKeys+' required Preview names are present locally. Current effective hosted values/presence were not re-inspected. No private values appear in the checklist. Previously pasted credentials require credential-owner review before activation; they were neither used for hosted access nor rotated here.',
 '',
 '## Approvals, integrity and handoff',
 '',
 'See [approval boundary](approval-boundary.md) and the preserved A01–A12 register. Historical database target text is superseded by the owner exclusion; it must not be executed as written. Existing stored principals receive no automatic new permissions.',
 '',
 'The candidate secret scan reports zero configured-private-value matches and selected private-format matches, with .env.local ignored and untracked. This is a bounded candidate scan, not a historical/universal secret guarantee. The local packaging allowlist includes the added runtime code/font/license; docs, reference, site, tests and .env files remain outside the staging artifact.',
 '',
 'Post-commit verification builds the exact committed artifact twice, verifies checksums/isolation/private-path exclusions and probes the unconfigured adapter fail-closed. Its result and literal SHA are in dist/figma-gap-closure/post-commit-verification.json. No artifact is uploaded or deployed.',
 '',
 'Local covered workflows: GO. Full four-application MVP/Figma certification: NO-GO. Hosted staging certification: NO-GO. Production readiness: NO-GO.',
 '',
 '## Exact changed files',
 '',
 ...changed.map(path=>'- '+path),
 ''
 ];
writeFileSync(reportPath,sections.join('\n'));
const sourceFiles=changed.filter(path=>path!==receiptPath).map(path=>({path,sha256LF:hash(path.endsWith('.woff2')?readFileSync(path):readFileSync(path,'utf8').replace(/\r\n/g,'\n'))}));
const evidencePaths=[output+'/repository.log',output+'/browser.log',output+'/browser-evidence.json',output+'/mvp-control-evidence.json',output+'/mvp-coverage.json',output+'/durable-browser.log',output+'/durable-browser/browser-evidence.json',output+'/durable-browser/mvp-control-evidence.json',output+'/postgres17-compatibility.json',...pg.suites.map(s=>s.log),output+'/performance.json',output+'/recovery.json',output+'/dependency-audit.json',output+'/secret-review.json',output+'/source-check.log',output+'/api-contract-evidence.json',output+'/screenshots.json',output+'/hosted-uat-matrix.json',output+'/manual-accessibility.json',output+'/environment-contract.json',output+'/font-provenance.json',...screenshots.map(s=>s.path)];
const receipt={schemaVersion:1,capturedAt:new Date().toISOString(),git:{branch,startingCommit:start,startingWorktree:'CLEAN',endingCommit:'Commit containing this receipt; literal SHA in dist/figma-gap-closure/post-commit-verification.json',localCommitAuthorized:true,pushAuthorized:false,hostedMutationAuthorized:false},decisions:{localCoveredWorkflows:'GO',fullFourApplicationConformity:'NO_GO_INCOMPLETE',hosted:'NO_GO',production:'NO_GO'},changedFiles:changed,sourceHashEncoding:'SHA-256; UTF-8 LF text, raw WOFF2; receipt self-hash excluded',sourceFiles,evidenceHashEncoding:'SHA-256 exact local artifact bytes',evidenceFiles:[...new Set(evidencePaths)].map(path=>({path,sha256:hash(readFileSync(path))})),tests:{repository,browser:{...browser.counts,backend:browser.backend,sourceUnchanged:browser.sourceUnchanged},durableBrowser:{...durable.counts,backend:durable.backend,sourceUnchanged:durable.sourceUnchanged,overlapsGeneral:true},postgres:{version:pg.serverVersion,leafScenarios:pg.leafScenarios,nodeChecks:pg.reportedNodeChecks,orchestrationParents:pg.suites.length},performance:{status:performance.status,scenarios:performance.scenarios.length},recovery:{status:recovery.status,observedRtoMs:recovery.observedRtoMs,observedRpoMs:recovery.observedRpoMs},hosted:{executed:0,...hosted.counts},humanAccessibility:{status:'NOT RUN',cases:manual.count},dependencyAudit:dependencies.metadata.vulnerabilities},accessibility:{generalScans:browser.accessibility.scanCount,generalViolations:browser.accessibility.violationCount,durableScans:durable.accessibility.scanCount,durableViolations:durable.accessibility.violationCount,conformance:'MANUAL_REVIEW_REQUIRED'},interactionCoverage:coverage.categories,newApiContracts:{passed:apiReport.passed,total:apiReport.total,percentage:apiReport.percentage,overallRepositoryPercentage:null},requirements:{total:requirements.total,counts:requirements.counts,strictCompleteRequirementRatio:requirements.strictCompleteRequirementRatio,figmaFunctionality:requirements.figmaFunctionalityConformity,visual:requirements.visualConformity},approvals:{identifiers:Array.from({length:12},(_,i)=>'A'+String(i+1).padStart(2,'0')),allPending:true,exclusiveStagingDatabase:null,managementConnectionOwner:null,invitationProviderOwner:null},limits:['Synthetic identity tests are not hosted authentication','Status-only browser queue is not native/photos/signature certification','Per-load fleet pay is not the complete PRD pay-model set','Source route/control inventory is not complete Figma or API coverage','Repository-safe implementation gaps remain open; see complete gap register'],postCommitVerification:'dist/figma-gap-closure/post-commit-verification.json'};
writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');writeFileSync(output+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({report:reportPath,receipt:receiptPath,changedFiles:changed.length,repository:repository.pass,browser:browser.counts.passed,durableBrowser:durable.counts.passed,postgresLeaves:pg.leafScenarios,decisions:receipt.decisions}));
