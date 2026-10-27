import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHostedEvidenceInventory,validateHostedEvidenceInventory} from '../domain/hosted-evidence-inventory.mjs';
import {hostedPrerequisites,hostedScenarios} from '../domain/operations-release.mjs';
const sourceHash='c'.repeat(64),base={sourceHash};
test('B276: missing hosted records are explicit and never authorize execution',()=>{
 const r=assessHostedEvidenceInventory(base);
 assert.equal(r.missing.length,8);
 assert.equal(r.scenarios.length,7);
 assert.ok(r.scenarios.every(s=>s.status==='NOT_EXECUTED'));
 assert.equal(r.decision,'NO-GO');
 assert.equal(r.executionAuthorized,false);
});
test('B277: all recorded reviews still cannot certify hosted tests',()=>{
 const records=Object.fromEntries(hostedPrerequisites.map(k=>[k,{sourceHash,evidenceSha256:'d'.repeat(64),reviewerId:'security-reviewer',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'}]));
 const r=assessHostedEvidenceInventory({...base,records});
 assert.equal(r.missing.length,0);
 assert.equal(r.hostedExecuted,false);
 assert.equal(r.decision,'NO-GO');
 assert.deepEqual(validateHostedEvidenceInventory(r,{...base,records}),{valid:true,decision:'NO-GO',hostedExecuted:false,missing:0});
});
test('B278: stale source, unknown fields and raw credential values fail closed',()=>{
 for(const entry of [
  {sourceHash:'a'.repeat(64),evidenceSha256:'d'.repeat(64),reviewerId:'reviewer',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'},
  {sourceHash,evidenceSha256:'d'.repeat(64),reviewerId:'password=unsafe',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'},
  {sourceHash,evidenceSha256:'d'.repeat(64),reviewerId:'reviewer',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED',secret:'unsafe'}
 ])assert.throws(()=>assessHostedEvidenceInventory({...base,records:{approvedConsent:entry}}));
});
test('B279: changed prerequisite or scenario status fails independent validation',()=>{
 for(const change of [r=>r.prerequisites.approvedConsent.status='REVIEW_RECORDED',r=>r.scenarios[0].status='PASS',r=>r.decision='GO']){
  const r=assessHostedEvidenceInventory(base);change(r);
  assert.throws(()=>validateHostedEvidenceInventory(r,base));
 }
});
test('B280: rejected review remains unresolved',()=>{
 const records={approvedConsent:{sourceHash,evidenceSha256:'d'.repeat(64),reviewerId:'reviewer',reviewedAt:'2026-10-13T00:00:00Z',decision:'REJECTED'}};
 const r=assessHostedEvidenceInventory({...base,records});
 assert.equal(r.prerequisites.approvedConsent.status,'REJECTED');
 assert.ok(r.missing.includes('approvedConsent'));
 assert.deepEqual(r.scenarios.map(s=>s.id),hostedScenarios.map(s=>s.id));
});
