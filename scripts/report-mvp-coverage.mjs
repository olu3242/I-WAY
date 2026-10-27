// Consumes explicit assertions from passing synthetic browser tests; no secrets.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const output=process.argv[2]??'dist';
const inventory=JSON.parse(readFileSync('docs/security/b591-mvp-inventory.json','utf8'));
const evidence=JSON.parse(readFileSync(output+'/mvp-control-evidence.json','utf8'));
const browser=JSON.parse(readFileSync(output+'/browser-evidence.json','utf8'));
const passing=evidence.tests.filter(t=>t.status==='passed');
// Reviewed assertion mappings may point to an existing explicit assertion in a passing
// test. Bind both the test title and its exact frozen source; discovery alone is insufficient.
let assertionMappings=[];
if(process.argv[3]){
 const {createHash}=await import('node:crypto');
 assertionMappings=JSON.parse(readFileSync(process.argv[3],'utf8')).mappings;
 for(const mapping of assertionMappings){const source=readFileSync(mapping.source,'utf8').replace(/\r\n/g,'\n'),sha=createHash('sha256').update(source).digest('hex');if(sha!==mapping.sha256||browser.sourceHashes[mapping.source]!==sha||!source.includes(mapping.assertion)||!passing.some(t=>t.test===mapping.test))throw Error('ASSERTION_MAPPING_NOT_VERIFIED');}
}
const controls=inventory.controls.map(control=>{
 const observedIn=passing.filter(t=>t.observed.some(c=>c.key===control.key||control.type==='route'&&c.path===control.value)).map(t=>t.test);
 const interactedIn=passing.filter(t=>t.interactions.some(c=>c.key===control.key)).map(t=>t.test);
 const verifiedIn=passing.filter(t=>t.verifiedOutcomes.includes(control.key)||control.type==='button'&&t.interactions.some(c=>c.label===control.label&&t.verifiedOutcomes.includes(c.key))||assertionMappings.some(m=>m.test===t.test&&m.keys.includes(control.key))).map(t=>t.test);
 return {...control,observedIn,interactedIn,verifiedIn,status:verifiedIn.length?'VERIFIED_LOCAL_OUTCOME':interactedIn.length?'INTERACTION_ONLY':observedIn.length?'OBSERVED_ONLY':'NOT_OBSERVED'};
});
const categories=Object.fromEntries([...new Set(controls.map(c=>c.type))].map(type=>{const rows=controls.filter(c=>c.type===type);return [type,{inventoried:rows.length,observed:rows.filter(c=>c.observedIn.length).length,interacted:rows.filter(c=>c.interactedIn.length).length,verifiedOutcome:rows.filter(c=>c.verifiedIn.length).length}];}));
const executable=controls.filter(c=>['action','form','navigation','button'].includes(c.type)),gaps=executable.filter(c=>!c.verifiedIn.length).map(c=>c.key);
const report={schemaVersion:1,scope:'implemented local synthetic UI; not hosted certification',browserStatus:browser.status,counts:browser.counts,accessibility:{scans:browser.accessibility.scanCount,violations:browser.accessibility.violationCount,conformance:browser.accessibility.conformance},coverageDecision:browser.status==='passed'&&!gaps.length?'GO_LOCAL_DISCOVERED_CONTROLS':'NO_GO_INCOMPLETE_CONTROL_EVIDENCE',categories,unverifiedExecutableControls:gaps,limitations:['Field variants, native-dialog assistive technology and every possible state combination are not independently certified by action/form coverage.','Routes include source patterns and API references; this inventory is not proof of every HTTP method and dynamic identifier.','Negative tests that intentionally receive a denial are distinct from successful mutation outcomes.','Hosted testing is blocked pending approved real tester access.'],controls};
mkdirSync('dist',{recursive:true});writeFileSync(output+'/mvp-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({decision:report.coverageDecision,categories,gaps}));
if(report.coverageDecision!=='GO_LOCAL_DISCOVERED_CONTROLS')process.exitCode=1;
