import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedReleaseDossier,validateHostedReleaseDossier} from '../domain/hosted-release-dossier.mjs';
import {hostedScenarios,hostedPrerequisites} from '../domain/operations-release.mjs';
const sourceHash='b'.repeat(64);
const options={sourceHash,localScenarioStatus:'PASS'};
test('B270: dossier binds local status but never authorizes hosted execution',()=>{
 const report=createHostedReleaseDossier(options);
 assert.equal(report.localScenarioStatus,'PASS');
 assert.equal(report.decision,'NO-GO');
 assert.equal(report.hostedExecuted,false);
 assert.equal(report.executionAuthorized,false);
 assert.deepEqual(validateHostedReleaseDossier(report,options),{valid:true,hostedDecision:'NO-GO',hostedExecuted:false,unresolved:8});
});
test('B271: source fingerprint must be current',()=>{
 assert.throws(()=>createHostedReleaseDossier({...options,sourceHash:'stale'}));
 const report=createHostedReleaseDossier(options);
 assert.throws(()=>validateHostedReleaseDossier(report,{...options,sourceHash:'c'.repeat(64)}));
});
test('B272: every hosted scenario has complete required assertion plan and no receipt',()=>{
 const report=createHostedReleaseDossier(options);
 assert.equal(report.checks.length,hostedScenarios.length);
 for(const item of report.checks){
  assert.deepEqual(item.requiredAssertions,hostedScenarios.find(s=>s.id===item.id).checks);
  assert.equal(item.status,'NOT_EXECUTED');
  assert.equal(item.receipt,'MISSING');
 }
});
test('B273: recorded approval metadata is not preflight authorization',()=>{
 const prerequisites=Object.fromEntries(hostedPrerequisites.map(k=>[k,{status:'verified',evidenceSha256:'a'.repeat(64),approvedBy:'reviewer',approvedAt:'2026-10-13T00:00:00Z'}]));
 const report=createHostedReleaseDossier({...options,prerequisites});
 assert.equal(report.unresolvedPrerequisites.length,0);
 assert.equal(report.preflight.status,'BLOCKED');
 assert.equal(report.executionAuthorized,false);
});
test('B274: rollback cannot be certified from a local fixture',()=>{
 const report=createHostedReleaseDossier(options);
 assert.equal(report.rollback.status,'NOT_EXECUTED');
 report.rollback.status='PASS';
 assert.throws(()=>validateHostedReleaseDossier(report,options));
});
test('B275: forged hosted GO, altered checks, and missing prerequisites fail closed',()=>{
 for(const change of [
  r=>r.decision='GO',
  r=>r.checks[0].status='PASS',
  r=>r.matrix.prerequisites={},
  r=>r.hostedExecuted=true
 ]){
  const report=createHostedReleaseDossier(options);
  change(report);
  assert.throws(()=>validateHostedReleaseDossier(report,options));
 }
});
