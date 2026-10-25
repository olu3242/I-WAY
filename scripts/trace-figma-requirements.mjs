// Auditable requirement review, not a visual similarity estimator.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
const out='docs/certification/figma-gap-closure';
const review={};
function rows(group,items){for(const [number,status,implemented,remaining] of items)review['FR-'+group+'-'+String(number).padStart(3,'0')]={status,implemented,remaining};}
const P='PARTIAL',M='MISSING',I='IMPLEMENTED_LOCAL',B='BLOCKED_DECISION';
rows('DRV',[
 [1,P,'Synthetic Google/password/session lifecycle and preferences','Native PIN, biometrics and trusted-device contract (ADR-002); real provider/MFA activation A07-A09'],
 [2,P,'Invitation acceptance and canonical identity mapping under synthetic providers','Complete onboarding/profile and sensitive document storage (OQ-08); approved delivery and real identities'],
 [3,P,'Active/compliance/approval gates and invitation lifecycle','Full onboarding status progression and needs-information review UI'],
 [4,P,'Scoped current assignments, compliance and approved earnings views','ETA, distance, messages and complete dashboard summaries; approved map/tracking provider'],
 [5,I,'Assigned load view, accept, reject with reason, release and replay-safe audited receipt','Hosted identity certification remains separate'],
 [6,P,'Ordered multi-stop pickup, transit, delivery and acknowledgment','Arrival/loading/unloading milestones and navigation integration'],
 [7,M,'No implemented geofence arrival workflow','Approved location/native contract plus manual-arrival UI and event transitions'],
 [8,M,'No live map or truck position claimed','Approved map/tracking provider, location consent and native/background decision'],
 [9,P,'Authorized immutable text/JSON shipping-document revisions','Rate-confirmation PDF storage and renderer'],
 [10,B,'Bounded recipient acknowledgment references only','Signed BOL/POD image storage, retention and signature evidence review (OQ-08/ADR-002); approved broker delivery'],
 [11,P,'Audited bounded text exceptions and human recovery workflow','Photo/attachment/location capture and remaining categories; reviewed storage and consent'],
 [12,P,'Shipping-document ingestion/revisions and independent human review','Driver identity-document upload/renewal and sensitive storage OQ-08'],
 [13,P,'Expiry/compliance gates deny dispatch','Complete compliance states, document types and configurable reminder windows'],
 [14,M,'No chat or call workflow claimed','Dispatcher contact consent, contact model and approved communications adapter'],
 [15,P,'Assigned equipment and service information','Truck-document access, registration/insurance/lease storage contract'],
 [16,I,'Assigned driver service reports persist into equipment-owner history','Hosted synchronization remains untested'],
 [17,P,'Explicit carrier service interval, odometer reports and due warnings','Automatic load-distance/geolocation odometer integration; ADR-002 and approved provider'],
 [18,P,'Notification preferences and local authentication workflows','Direct-deposit storage OQ-08; complete profile, password-change and support screens'],
 [19,P,'Only own approved carrier settlement or fleet driver pay; commercial source fields withheld','Period summaries, reimbursements, statement/report PDFs and full history filters'],
 [20,M,'No driver expense submission claimed','Owned expense submission/review contract, UI, evidence storage and reimbursement linkage'],
 [21,P,'IndexedDB bounded status queue, static recovery shell, reload/reconnect and exactly-once server replay','Native delivery ADR-002; secure photos/signatures offline storage and device review']
]);
rows('CAR',[
 [1,P,'Tenant-scoped operational totals and analytics','Full finance/resource/compliance KPI set and fleet breakdown'],
 [2,P,'Validated load creation with rates, ordered stops and dispatcher ownership','Four-step wizard, inline broker/customer/facility creation, windows, private notes and dimensions'],
 [3,P,'Search plus active/completed lists with carrier-time-zone presentation','Request-date range filters and complete reference list columns'],
 [4,P,'Owned load detail, human tracking, assignment and reviewed shipping metadata','Live location/distance, PDF attachments and approved broker tracking-link delivery'],
 [5,I,'Eligible assignment/reassignment, one active assignment, audited cancellation','Hosted four-persona certification remains blocked'],
 [6,P,'Scoped resource/capacity overview and human dispatch','Live map, truck positions and route lines; approved tracking provider'],
 [7,P,'Audited void and pre-pickup assignment changes','Full status-aware correction/TONU contract protecting approved financial sources'],
 [8,P,'Local lifecycle notification outbox and broker connector mocks','Owner-approved broker book of record, delivery provider/sender and real delivery certification'],
 [9,P,'Protected invitation/session workflow and company configuration','Complete typed onboarding hub for all resource classes and document approval gates'],
 [10,P,'Company directory configuration scaffolding','Verified typed broker/factor address forms and relationship workflows'],
 [11,P,'Role-scoped drivers/equipment, ownership, edits and approvals','Asset subnavigation and full typed truck detail'],
 [12,P,'Vehicle ownership, capacity and approval gates','Vehicle-type wizard, financial settings and sensitive document package'],
 [13,P,'Scoped equipment maintenance edits and separate service-plan form','Section-specific truck/driver assignment, financial terms and deduction editor'],
 [14,P,'Carrier intervals, warnings and driver/owner service history','Automatic load-distance/location integration required by linked FR-DRV-017'],
 [15,P,'Driver availability/compliance edits and approved pay projection','Full profile/employment/documents, vehicle pay terms, escrow history and PDFs'],
 [16,P,'Invitation lifecycle and dispatch eligibility gates','Complete admin/invite onboarding progress UI'],
 [17,P,'Dispatcher account management and scoped permissions','Dispatcher payment models/reports and sensitive onboarding policy OQ-08'],
 [18,P,'Carrier approvals, expiry gates and out-of-service hold enforcement','All driver/equipment/fleet document classes, complete review/reminder states'],
 [19,P,'Customer relationships and bounded administrative configuration','Typed broker/factor/facility/rate/terms/history modules'],
 [20,P,'Carrier account/permission governance with tenant-scoped denies','Accounting role and complete approved role catalog/delegation UI'],
 [21,P,'Weekly draft/recalculate/adjust/approve/unapprove, immutable evidence and fleet disputes','Week navigation, moves, search and approved statement PDFs; cutoff policy OQ-04'],
 [22,P,'Integer-cent fixture calculation, weekly uniqueness, source-version checks and escrow cap','Vehicle-sourced approved terms, full pay models and v1 parallel reconciliation data'],
 [23,P,'Document-reviewed invoice generation, issue and receivable lifecycle','Three-PDF packet, invoice-format OQ-05, downloads and approved broker/factor delivery'],
 [24,P,'Reported payment evidence, independent review and reconciliation fixtures','Actual provider/remittance integration and owner-approved payment scope OQ-06'],
 [25,P,'Measured operational analytics','Complete accounting report list, period summaries and exports'],
 [26,P,'Fleet ownership, employment, equipment and carrier eligibility controls','Fleet Management Agreement lifecycle, all financial/document/banking controls'],
 [27,P,'Fleet revenue/fees/deductions/escrow/adjustment/net approval','Actual payment execution and complete agreement-bound financial terms']
]);
rows('FLT',[
 [1,P,'Own assets, assignments, settlements and driver-pay views','Full period earnings/payment/maintenance dashboard'],
 [2,P,'Own driver employment, account activation fixtures and carrier approval boundary','Complete invite/document/pay configuration and performance views; hosted identities A08-A09'],
 [3,P,'Own vehicle creation/editing and maintenance reports preserve carrier holds','Trailer/type, document and removal-request workflows'],
 [4,I,'Own driver/equipment loads only; commercial rates and foreign assignments withheld','Hosted certification remains blocked'],
 [5,P,'Fleet-owned service review; carrier receives compliance-relevant projection','Complete maintenance scheduling/vendor/cost workflows'],
 [6,P,'Own carrier settlement view and immutable dispute sidecar','Acknowledgment, approved PDF and dispute resolution workflow'],
 [7,P,'Explicit per-load draft and approval with current employment and settlement budget checks','Percentage, mileage, flat-week, salary and custom terms with approved calculation bases'],
 [8,P,'Read-only system-calculated approved contributions','Full opening/debit/claim/refund/closing escrow ledger and dispute resolution'],
 [9,P,'Own driver employment and preferences','Fleet staff roles, invitations and company settings contract']
]);
rows('ADM',[
 [1,P,'Protected governance namespace and tenant-bound synthetic fixtures','Carrier-tenant lifecycle, subscriptions and approved management-plane authority'],
 [2,P,'Canonical privileged invitation/MFA fixtures and session gates','Real AAL2 evidence, staff account management and approved identity provisioning'],
 [3,M,'Platform operational tenant access is denied','Explicit scoped support grant/reason/expiry contract and management-plane read API; no authorization bypass'],
 [4,M,'No platform finance monitoring claimed','Approved billing/payment providers and isolated aggregate monitoring contracts'],
 [5,M,'No platform case-management application claimed','Case schema, owner role permissions and end-to-end case workflow'],
 [6,P,'Carrier configuration is isolated from platform governance','Platform global configuration with approved override/delegation catalog'],
 [7,P,'Protected platform governance audit viewer','Scoped cross-tenant audit access with reason-bound grants and sensitive-data policy']
]);
rows('X',[
 [1,P,'Shared lifecycle compatibility projection','Complete PRD status/substatus mapping and all unimplemented resource lifecycles'],
 [2,P,'In-app records, preferences, durable outbox and mocked adapters','Approved email/push/SMS providers, sender/owner and actual delivery certification'],
 [3,I,'Role, permission, tenant, relationship and ownership gates; restricted PostgreSQL FORCE RLS tested locally','Hosted target, authenticated restricted login and roster certification remain blocked'],
 [4,P,'Audited local consequential actions and append-only evidence','Full BR-012 coverage cannot be certified for unimplemented actions'],
 [5,B,'Sensitive collection is not enabled','Owner-approved encryption, access logging, retention/deletion and legal/security policy OQ-08'],
 [6,P,'Bounded document references and immutable text content','PDF/upload/download pipeline with hostile filename tests'],
 [7,I,'Implemented views refresh from persisted API state after saves','No claim for absent screens']
]);
review['FR-DS-01']={status:P,implemented:'Unmodified logo, local Inter, token colors, card/button radii, driver targets and textual status chips tested',remaining:'Original Figma exports/version BLOCKED_REFERENCE; complete typography/icon/spacing review and human accessibility remain outstanding'};
const groups={
 DRV:{reference:'DriverApp.tsx',ui:['apps/operations/ops.js','apps/operations/driver-offline.mjs','apps/operations/financial.js','apps/operations/maintenance.js'],tests:['tests/driver-offline-integration.test.mjs','tests/browser/driver-offline.spec.mjs','tests/driver-assignment-response.test.mjs','tests/browser/load-search-rejection.spec.mjs','tests/operations-maintenance.test.mjs','tests/browser/maintenance.spec.mjs','tests/operations-settlements.test.mjs','tests/browser/settlements.spec.mjs']},
 CAR:{reference:'CarrierAdmin.tsx',ui:['apps/operations/ops.js','apps/operations/admin.js','apps/operations/financial.js','apps/operations/maintenance.js'],tests:['tests/browser/operations.spec.mjs','tests/browser/administration.spec.mjs','tests/operations-settlements.test.mjs','tests/browser/settlements.spec.mjs','tests/operations-maintenance.test.mjs','tests/browser/maintenance.spec.mjs']},
 FLT:{reference:'FleetPortal.tsx',ui:['apps/operations/ops.js','apps/operations/financial.js','apps/operations/maintenance.js'],tests:['tests/browser/accessibility.spec.mjs','tests/operations-settlements.test.mjs','tests/browser/settlements.spec.mjs','tests/operations-maintenance.test.mjs']},
 ADM:{reference:'PlatformAdmin.tsx',ui:['server/operations-uat-application.mjs'],tests:['tests/operations-uat-application.test.mjs','tests/browser/uat-application.spec.mjs','tests/browser/responsive-personas.spec.mjs']},
 X:{reference:'../context/OperationsContext.tsx',ui:['apps/operations/ops.js','apps/operations/extended.js'],tests:['tests/operations-auth-authorization.test.mjs','tests/operations-uat-application.test.mjs','tests/browser/mvp-controls.spec.mjs','tests/local/durable-operations-postgres.test.mjs']},
 DS:{reference:'../index.css',ui:['apps/operations/ops.css','apps/operations/i-way-logo.svg','apps/operations/InterVariable.woff2'],tests:['tests/browser/brand-tokens.spec.mjs','tests/browser/responsive-personas.spec.mjs']}
};
// These are implementation/evidence locations to review, not synthetic PASS labels.
const prd=readFileSync('docs/PRD.md','utf8');
const requirements=[...prd.matchAll(/^\| (FR-(?:DRV|CAR|FLT|ADM|X)-\d{3}|FR-DS-01) \| ([^\n]+?) \| (P[012]) \|/gm)].map(match=>{
 const [id,requirement,priority]=match.slice(1),r=review[id];if(!r)throw Error('UNREVIEWED_REQUIREMENT '+id);
 const group=id.split('-')[1],g=groups[group];
 return {id,requirement:requirement.trim(),priority,...r,reference:posix.normalize('reference/figma-make-prototype/src/components/'+g.reference),route:group==='ADM'?'/uat/control':'/app',ui:g.ui,api:group==='ADM'?['POST /api/ops/platform']:['GET /api/ops/state','POST /api/ops/commands',...(id==='FR-DRV-021'?['GET /api/ops/offline/context','POST /api/ops/offline']:[])],domain:group==='ADM'?['server/operations-platform.mjs']:['domain/operations.mjs','domain/authorization.mjs',...(/settlement|earnings|pay|escrow/i.test(r.implemented)?['domain/operations-settlements.mjs']:[]),...(/service|maintenance/i.test(r.implemented)?['domain/operations-maintenance.mjs']:[])],database:['server/operations-store.mjs','server/operations-durable-postgres.mjs','db/review-only/b662-operations-engine.sql'],testFiles:g.tests,evidence:'dist/figma-gap-closure/receipt.json (final executed-suite evidence; a test-file reference alone is not PASS)',hostedStatus:'BLOCKED',visualStatus:'BLOCKED_REFERENCE'};
});
if(requirements.length!==Object.keys(review).length)throw Error('TRACE_REQUIREMENT_SET_MISMATCH');
const sources=new Set(['docs/PRD.md','reference/README.md','docs/brand/tokens/iway-tokens.json',...requirements.flatMap(r=>[r.reference,...r.ui,...r.domain,...r.database,...r.testFiles])]);
const sourceHashes=Object.fromEntries([...sources].sort().map(path=>[path,createHash('sha256').update(path.endsWith('.woff2')?readFileSync(path):readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const counts=Object.fromEntries([I,P,M,B].map(status=>[status,requirements.filter(r=>r.status===status).length]));
const report={schemaVersion:1,sourceHashEncoding:'SHA-256; text UTF-8 with LF, binary WOFF2 raw bytes',authority:{functional:'Checked-in prototype and PRD, subject to documented decisions',visual:'Brand Kit; legacy dark/amber prototype styling superseded',canonicalFigmaVersion:null,originalScreenExports:null},counts,total:requirements.length,strictCompleteRequirementRatio:{numerator:counts[I],denominator:requirements.length,percentage:100*counts[I]/requirements.length,meaning:'Whole PRD rows implemented and locally verifiable; partial compound requirements receive zero full-row credit. This is not a Figma visual or functional conformity percentage.'},figmaFunctionalityConformity:{status:'NOT_CERTIFIED',percentage:null,reason:'Complete screen/action/state acceptance evidence is absent; original Make provenance is not version-pinned.'},visualConformity:{status:'BLOCKED_REFERENCE',percentage:null},requirements,sourceHashes};
mkdirSync(out,{recursive:true});writeFileSync(out+'/requirements.json',JSON.stringify(report,null,2)+'\n');
writeFileSync(out+'/gap-register.md','# Figma/PRD requirement review\n\n'+
 'Every FR row is included. PARTIAL and MISSING are implementation gaps, not external blockers. BLOCKED_DECISION applies only to the specified unresolved sensitive/native contract. Local test results do not certify hosted authentication.\n\n'+
 '| Requirement | Priority | Status | Verified implementation scope | Remaining gap / next action |\n|---|---|---|---|---|\n'+requirements.map(r=>'| '+r.id+' | '+r.priority+' | '+r.status+' | '+r.implemented+' | '+r.remaining+' |').join('\n')+'\n');
console.log(JSON.stringify({total:report.total,counts,strictCompleteRequirementRatio:report.strictCompleteRequirementRatio,figmaFunctionalityConformity:report.figmaFunctionalityConformity,visualConformity:report.visualConformity}));
