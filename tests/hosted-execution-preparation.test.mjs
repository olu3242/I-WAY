import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedExecutionPreparation,validateHostedExecutionPreparation} from '../domain/hosted-execution-preparation.mjs';
import {hostedPrerequisites,hostedScenarios} from '../domain/operations-release.mjs';
const sourceHash='e'.repeat(64),base={sourceHash};
test('B286: missing authorization blocks execution',()=>{
 const r=createHostedExecutionPreparation(base);
 assert.equal(r.missing.length,8);assert.equal(r.executionAuthorized,false);assert.equal(r.decision,'NO-GO');
});
test('B287: restricted identity, consent and fixtures require independent review',()=>{
 const r=createHostedExecutionPreparation(base);
 for(const k of ['restrictedPostgresAuthentication','approvedConsent','approvedIntegrationFixtures'])assert.equal(r.prerequisites[k].status,'MISSING');
});
test('B288: complete review metadata cannot authorize hosted access',()=>{
 const approvals=Object.fromEntries(hostedPrerequisites.map(k=>[k,{sourceHash,evidenceSha256:'a'.repeat(64),reviewerId:'independent-reviewer',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'}]));
 const r=createHostedExecutionPreparation({...base,approvals});
 assert.equal(r.missing.length,0);assert.equal(r.executionAuthorized,false);assert.equal(r.hostedExecuted,false);
 assert.deepEqual(validateHostedExecutionPreparation(r,{...base,approvals}),{valid:true,hostedDecision:'NO-GO',hostedExecuted:false});
});
test('B289: stale source and injected secrets fail closed',()=>{
 assert.throws(()=>createHostedExecutionPreparation({sourceHash:'invalid'}));
 assert.throws(()=>createHostedExecutionPreparation({...base,approvals:{approvedConsent:{sourceHash,evidenceSha256:'a'.repeat(64),reviewerId:'password=abc',reviewedAt:'2026-10-13T00:00:00Z',decision:'APPROVED'}}}));
});
test('B290: seven scenarios remain unexecuted with approved synthetic fixtures required',()=>{
 const r=createHostedExecutionPreparation(base);
 assert.deepEqual(r.scenarios.map(s=>s.id),hostedScenarios.map(s=>s.id));
 assert.ok(r.scenarios.every(s=>s.status==='NOT_EXECUTED'&&s.syntheticFixture==='REQUIRES_APPROVAL'));
});
test('B291-B295: fabricated hosted GO, approvals, scenario PASS or rollback completion are rejected',()=>{
 for(const change of [r=>r.decision='GO',r=>r.executionAuthorized=true,r=>r.scenarios[0].status='PASS',r=>r.scenarios[6].evidence='COMPLETE',r=>r.prerequisites.approvedConsent.status='REVIEW_RECORDED']){
  const r=createHostedExecutionPreparation(base);change(r);
  assert.throws(()=>validateHostedExecutionPreparation(r,base));
 }
});
