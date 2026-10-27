// Repository-only screen reconciliation. No credentials, network calls or visual estimates.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=path=>readFileSync(path,'utf8');
const root='reference/figma-make-prototype/src/components/';
export const prototypeFiles={carrier:'CarrierAdmin.tsx',fleet:'FleetPortal.tsx',driver:'DriverApp.tsx',platform:'PlatformAdmin.tsx'};
export function prototypeScreens(source){
 const declaration=source.match(/type (?:Screen|Tab) = ([^\r\n]+)/);
 if(!declaration)throw Error('PROTOTYPE_SCREEN_DECLARATION_MISSING');
 return [...declaration[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
}
// Route is a real HTTP route; navigation identifies the existing client view, not a fictional URL.
// Partial is a whole-screen assessment: working subsets are stated explicitly below.
const C='partial',D='design-only',O='obsolete-in-design';
function row(persona,screen,targets,permissions,working,gap,tests,status=C){
 return {id:persona+':'+screen,persona,screen,status,route:targets.length?(persona==='platform'?'/uat/control':'/app'):null,navigation:targets,permissions,authorization:persona==='platform'?'AAL2 + platform permission + isolated governance namespace; no operational tenant access':'Role + stored permission + tenant + relationship + resource ownership; server is authoritative',workingScope:working,remaining:gap,testFiles:tests.map(t=>'tests/browser/'+t+'.spec.mjs')};
}
const common=['responsive-personas','uat-application'];
const records=[
 row('carrier','dashboard',['overview','analytics'],['load:view','analytics:view'],'Persisted visible loads and measured operations totals','Prototype finance/compliance KPI layout and complete fleet breakdown are not implemented',common),
 row('carrier','load-manager',['loads','load-wizard'],['load:view','load:create','load:dispatch'],'Four-step creation, durable drafts, review, confirmation, safe retry, dispatch and execution','Specialized equipment types need an approved contract; live map/provider absent',['b681-load-wizard','load-wizard-recovery','operations']),
 row('carrier','dispatchers',['people'],['user:manage'],'Tenant-scoped accounts and bounded permission delegation','Dispatcher pay/reporting and sensitive onboarding policy remain incomplete',['administration','onboarding']),
 row('carrier','fleet-resources',['assets','maintenance'],['asset:view','asset:manage','driver:approve','vehicle:approve'],'Owned assets, employment and independent carrier eligibility holds','Full truck detail, sensitive attachments and specialized equipment contract',['maintenance','operations']),
 row('carrier','directory',['directories','customers'],['customer:manage'],'Persisted typed broker/customer/factor/facility records and relationships','Approved external book of record and delivery remain blocked',['directories']),
 row('carrier','onboarding',['onboarding','people'],['user:manage','driver:approve'],'Typed local onboarding submissions, needs-information and activation gates','No real identities or invitations; approved delivery and sensitive storage absent',['onboarding']),
 row('carrier','compliance',['assets','documents','onboarding'],['driver:approve','vehicle:approve','document:review'],'Carrier holds, expiry eligibility, shipping-document review and onboarding status','Complete identity/equipment document packages, reminders and storage policy',['maintenance','onboarding','operations']),
 row('carrier','accounting',['settlements','billing','finance'],['settlement:manage','billing:manage','finance:manage'],'Integer-cent statements, invoice readiness, approved PDFs and receivable evidence','Payment provider and approved delivery absent; approval never means transferred money',['settlements','pdf-downloads','b691-expenses']),
 row('carrier','reports',['analytics','settlements'],['analytics:view','settlement:view'],'Measured operational summaries and governed statement PDFs','Full accounting report catalog and exports incomplete',['settlements','pdf-downloads',...common]),
 row('carrier','settings',[],['governance:manage'],'Existing company settings and deny-only configuration at /admin','Separate /admin route retained; no silent permission expansion',['administration'],C),
 row('fleet','dashboard',['overview'],['load:view'],'Own loads/assets/approved statements projected by server','Complete period/payment/maintenance dashboard incomplete',common),
 row('fleet','drivers',['assets','people','onboarding'],['asset:view','employment:manage'],'Own employment and local profile lifecycle; carrier approval independent','Hosted accounts and full sensitive document package blocked',['onboarding','operations']),
 row('fleet','equipment',['assets','maintenance'],['asset:manage','asset:service'],'Owned equipment edits/service history retain carrier holds','Specialized trailer/type and removal policy incomplete',['maintenance']),
 row('fleet','loads',['loads'],['load:view'],'Own assigned loads; commercial rates and foreign assignments withheld','Original visual comparison blocked; live tracking not connected',['operations',...common]),
 row('fleet','maintenance',['maintenance'],['asset:service'],'Owner service review, odometer reports, explicit intervals and due warnings','Automatic distance/location and vendor/cost scheduling absent',['maintenance']),
 row('fleet','settlements',['settlements'],['settlement:view','settlement:dispute'],'Own approved carrier statements, immutable disputes and PDF downloads','Acknowledgment/dispute resolution and actual payment are incomplete',['settlements','pdf-downloads']),
 row('fleet','driver-pay',['driver-pay'],['payroll:manage'],'Explicit six-model terms, approval/revision, source budget and expense allocation','No invented employment terms or payment execution',['fleet-pay-models','b691-expenses']),
 row('fleet','escrow',['settlements'],['settlement:view'],'Read-only approved escrow contributions','Full debit/refund/claim/opening/closing ledger requires approved contract',['settlements']),
 row('fleet','compliance',['assets','onboarding'],['asset:view'],'Own eligibility/approval states; fleet cannot clear carrier holds','Full compliance document packages/reminder contract not complete',['maintenance','onboarding']),
 row('driver','loads',['loads'],['load:view','load:execute','pod:record'],'Own assignment acceptance/rejection, ordered stops, pickup/transit/delivery and bounded acknowledgments','Arrival/geofence/maps and signed-image storage need approved contracts',['operations','load-search-rejection','driver-offline']),
 row('driver','truck',['assets','maintenance'],['asset:view','asset:service'],'Assigned equipment and durable service reports','Registration/insurance/lease storage and live odometer integration absent',['maintenance']),
 row('driver','documents',['loads','onboarding'],['document:view','document:manage'],'Authorized reviewed shipping metadata/revisions, summaries and owned profile states','No sensitive uploads, signature images or identity-document storage',['operations','onboarding','pdf-downloads']),
 row('driver','pay',['settlements','expenses'],['settlement:view','payroll:view'],'Own approved earnings, period summaries/PDFs and governed expenses','Full payment evidence/provider and policy-dependent ledger cases blocked',['settlements','expenses','b691-expenses','pdf-downloads']),
 row('driver','chat',[],[],'No real dispatcher chat or call adapter','Approved contact model, consent, delivery provider and authorization contract required',[],D),
 row('driver','profile',['onboarding','notifications'],['notification:preferences'],'Owned onboarding profile and persisted notification preferences','PIN/biometrics/trusted-device contract and sensitive banking/storage absent',['onboarding',...common]),
 row('platform','dashboard',[],[],'Governance-only workspace retained','Prototype cross-tenant operational metrics cannot be reintroduced without scoped authority',['platform-workspace'],O),
 row('platform','carriers',[],['platform:invite'],'Canonical invitation contract and local management fixtures exist','Carrier lifecycle and subscription management surface incomplete',['uat-application']),
 row('platform','fleet-cos',[],[],'No operational tenant reader granted','Owner-approved scoped management reader, independent approval/reason/expiry required',['platform-workspace'],O),
 row('platform','drivers',[],[],'No global driver PII reader granted','Owner-approved management scope and privacy policy required',['platform-workspace'],O),
 row('platform','loads',[],[],'Platform operational access explicitly denied','Prototype global loads/impersonation must not bypass tenant isolation',['platform-workspace','operations'],O),
 row('platform','payments',[],[],'No platform payment execution or monitoring claimed','Approved isolated billing/provider contract absent',[],D),
 row('platform','cases',['#platform-workspace'],['platform:cases'],'Persisted cases with owner, transitions, reasons, versions and replay-safe commands','Hosted governance identities and real external support delivery blocked',['platform-workspace']),
 row('platform','compliance',[],[],'Operational compliance remains with carrier owner','Global compliance view requires explicitly scoped management contract',['platform-workspace'],O),
 row('platform','config',['#platform-config'],['platform:configure'],'Governed case-response configuration with reason/audit','Global override/delegation catalog absent',['platform-workspace']),
 row('platform','audit',['#audit-action'],['platform:audit'],'Governance audit read and isolated activity viewer','Cross-tenant operational audit needs explicit scoped grant',['platform-workspace',...common])
];
// Prototype footer buttons without handlers are design-only, not application defects to copy.
const secondary={fleet:['Documents','Reports','Users','Settings'],platform:['Risk','Settlements','Platform Billing','Users & Access','System']};
export function buildReconciliation(){
 const screens=Object.fromEntries(Object.entries(prototypeFiles).map(([role,file])=>[role,prototypeScreens(read(root+file))]));
 for(const [role,ids]of Object.entries(screens)){
  const actual=records.filter(r=>r.persona===role).map(r=>r.screen);
  if(JSON.stringify(ids)!==JSON.stringify(actual))throw Error('SCREEN_MAPPING_DRIFT '+role);
 }
 const rows=records.map(r=>{
  const source=root+prototypeFiles[r.persona],text=read(source),needle=(r.persona==='driver'?"id: '":"screen === '")+r.screen+"'",index=text.indexOf(needle);
  return {...r,reference:{file:source,line:1+text.slice(0,index<0?0:index).split('\n').length-1},route:r.id==='carrier:settings'?'/admin':r.route,
   api:r.persona==='platform'?(r.route?['POST /api/ops/platform','POST /api/ops/platform/workspace']:[]):r.id==='carrier:settings'?['GET /api/ops/admin/settings','POST /api/ops/admin/settings','GET /api/ops/admin/audit']:r.route?['GET /api/ops/state','POST /api/ops/commands']:[],
   implementation:r.persona==='platform'?['server/operations-uat-application.mjs','server/operations-platform-workspace.mjs','apps/operations/platform-workspace.js']:r.id==='carrier:settings'?['apps/operations/admin.js','server/operations-admin.mjs']:['apps/operations/ops.js','apps/operations/extended.js','domain/authorization.mjs','domain/operations.mjs'],
   localEvidence:{status:'NOT_RUN',meaning:'Test-file links are regression candidates, never proof of a complete prototype screen'},visual:{status:'BLOCKED_REFERENCE',percentage:null},hosted:{status:'BLOCKED',executed:0}};
 });
 const paths=[...new Set(['docs/PRD.md','docs/BRD.md','docs/brand/tokens/iway-tokens.json','reference/README.md',...rows.flatMap(r=>[r.reference.file,...r.implementation,...r.testFiles]),'apps/operations/load-wizard.js','apps/operations/expenses.js','apps/operations/financial.js','apps/operations/driver-offline.mjs','apps/operations/intelligence.js','domain/operations-intelligence.mjs','apps/operations/ops.css','domain/operations-platform-contract.mjs','server/operations-uat-session-bridge.mjs','tests/operations-uat-application.test.mjs','server/operations-owner-profiles.mjs','server/operations-identity.mjs','tests/browser/b751-b770.spec.mjs','tests/browser/b771-b790.spec.mjs','tests/browser/b791-platform-persistence.spec.mjs','tests/browser/platform-workspace.spec.mjs','tests/browser/owner-profiles.spec.mjs'])].sort();
 for(const path of paths)if(!existsSync(path))throw Error('TRACE_PATH_MISSING '+path);
 return {schemaVersion:1,issue:'https://github.com/olu3242/I-WAY/issues/20',authority:['Verified implementation and security contracts','Approved PRD/BRD/Brand Kit','Checked-in prototype flow structure; legacy styling superseded'],sourceHashEncoding:'SHA-256 of UTF-8 LF text',sourceHashes:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex')])),primaryScreenCount:rows.length,screens:rows,secondaryPrototypeControls:Object.entries(secondary).flatMap(([persona,labels])=>labels.map(label=>({persona,label,status:D,reason:'Prototype footer button has no navigation handler; current authorization is authoritative'}))),preservedImplementationExtensions:[
 {capability:'Four-step load wizard and guarded corrections',files:['apps/operations/load-wizard.js','domain/operations-load-wizard.mjs'],reason:'Preserve newer durable drafts, versioning and retry contracts'},
 {capability:'Driver expense corrections, employer reviews and reimbursement integrity',files:['apps/operations/expenses.js','domain/operations-expenses.mjs'],reason:'Not removed because the prototype omits this workflow'},
 {capability:'Offline driver replay and recovery',files:['apps/operations/driver-offline.mjs','domain/driver-offline-replay.mjs'],reason:'Keep bounded device queue, session binding, exactly-once receipts and logout purge'},
 {capability:'Advisory agents and human approval boundaries',files:['apps/operations/intelligence.js','domain/operations-intelligence.mjs'],reason:'Preserve current role/tool surfaces; MAX/PULSE/CLARA/GUARDIAN/FINN/SAGE/ATLAS labels do not establish live providers'},
 {capability:'Onboarding, pay models, governed PDFs and platform cases',files:['apps/operations/onboarding.js','apps/operations/financial.js','server/operations-pdf.mjs','server/operations-platform-workspace.mjs'],reason:'Current persisted business contracts outrank demo behavior'}
 ],decisions:[
 {id:'H01',decision:'Keep current permission-filtered workspace tabs and all newer capabilities; do not replace server-backed workflows with static prototype cards'},
 {id:'H02',decision:'Retain canonical i-way-logo.svg asset filenames; brand display text is independent of filesystem paths; logo bytes remain unmodified by this work'},
 {id:'H03',decision:'Integrated PR #19 (893f7f56d39d3e1a46c8bddadb71265216b30ae1), including PR #18 (a2090b9d8ad70329eb2412a1af4befbac241b918), preserves server-verified owner-profile selection, current memberships, AAL2, rotated cookie/CSRF and owner-attributed audit. No real profile grants were created. Prototype app selection never grants authority'},
 {id:'H04',decision:'Existing platform governance is not a global operational portal; obsolete prototype tenant readers remain denied'},
 {id:'H05',decision:'Original Figma URL/version/exports are absent; captures compare current responsive/token behavior only. No visual or functional conformity percentage is certified'}
 ],coverageBoundary:'All root Screen/Tab identifiers and known inert footer navigation mapped; nested panels, dialogs, permutations and all PRD clauses still require separate acceptance review. This is not complete screen/state conformity.',conformity:{functionalityPercentage:null,visualPercentage:null,status:'NOT_CERTIFIED'},hosted:'BLOCKED'};
}
export function writeReconciliation(output='docs/certification/harmonized-figma'){
 const report=buildReconciliation();mkdirSync(output,{recursive:true});writeFileSync(output+'/matrix.json',JSON.stringify(report,null,2)+'\n');
 writeFileSync(output+'/matrix.md','# Harmonized screen and functionality matrix\n\nSource: [Issue #20]('+report.issue+'). Route and navigation are separate: client tabs are not fictional HTTP routes. Every mapped screen remains partial unless its complete acceptance criteria have evidence. Test paths identify regression scope, not PASS. Current executed subsets and preserved denials: [B751–B770 execution matrix](../b751-b770/screen-evidence.md) and [B771–B790 captures and certification](../b771-b790/certification-report.md).\n\n| Persona / prototype screen | Current route · navigation | Required permissions | Working scope | Status / remaining gap |\n|---|---|---|---|---|\n'+report.screens.map(r=>'| '+r.id+' | '+(r.route??'No approved route')+' · '+r.navigation.join(', ')+' | '+r.permissions.join(', ')+' | '+r.workingScope+' | '+r.status+': '+r.remaining+' |').join('\n')+'\n\n'+report.coverageBoundary+'\n\n## Design decisions\n\n'+report.decisions.map(d=>'- '+d.id+': '+d.decision).join('\n')+'\n');return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=writeReconciliation();console.log(JSON.stringify({screens:r.primaryScreenCount,secondary:r.secondaryPrototypeControls.length,conformity:r.conformity}));}
