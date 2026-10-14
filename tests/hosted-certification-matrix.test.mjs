import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedCertificationMatrix,validateHostedCertificationMatrix} from '../domain/hosted-certification-matrix.mjs';
import {hostedPrerequisites,hostedScenarios} from '../domain/operations-release.mjs';
test('B266: missing approvals block all hosted scenarios',()=>{
 const report=createHostedCertificationMatrix();
 assert.equal(report.decision,'NO-GO');
 assert.equal(report.hostedExecuted,false);
 assert.equal(report.unresolved.length,hostedPrerequisites.length);
 assert.equal(report.scenarios.length,hostedScenarios.length);
 assert.ok(report.scenarios.every(s=>s.status==='NOT_EXECUTED'));
 assert.deepEqual(validateHostedCertificationMatrix(report),{valid:true,decision:'NO-GO',hostedExecuted:false});
});
test('B267: recorded metadata cannot grant execution or GO',()=>{
 const approvals=Object.fromEntries(hostedPrerequisites.map(k=>[k,{status:'verified',evidenceSha256:'a'.repeat(64),approvedBy:'reviewer',approvedAt:'2026-10-13T00:00:00Z'}]));
 const report=createHostedCertificationMatrix(approvals);
 assert.equal(report.unresolved.length,0);
 assert.equal(report.executionAuthorized,false);
 assert.equal(report.decision,'NO-GO');
 assert.ok(report.scenarios.every(s=>s.status==='NOT_EXECUTED'));
});
test('B268: fabricated execution status fails validation',()=>{
 const report=createHostedCertificationMatrix();
 report.scenarios[0].status='PASS';
 assert.throws(()=>validateHostedCertificationMatrix(report));
});
test('B269: secret-bearing evidence metadata is rejected',()=>{
 assert.throws(()=>createHostedCertificationMatrix({approvedConsent:{status:'verified',evidenceSha256:'a'.repeat(64),approvedBy:'password=abc',approvedAt:'2026-10-13T00:00:00Z'}}));
});
