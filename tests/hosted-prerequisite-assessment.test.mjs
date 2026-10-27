import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHostedPrerequisites} from '../domain/hosted-prerequisite-assessment.mjs';
import {hostedPrerequisites} from '../domain/operations-release.mjs';

test('B244 offline assessment defaults to fail closed',()=>{
 const result=assessHostedPrerequisites();
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.hostedExecuted,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.networkCalls,0);
 assert.equal(Object.keys(result.prerequisites).length,8);
 assert.ok(Object.values(result.prerequisites).every(v=>v.status==='BLOCKED'));
});
test('B244 evidence metadata never grants hosted execution',()=>{
 const input=Object.fromEntries(hostedPrerequisites.map(k=>[k,{status:'verified',evidenceSha256:'a'.repeat(64),approvedBy:'reviewer',approvedAt:'2026-10-13T00:00:00Z'}]));
 const result=assessHostedPrerequisites(input);
 assert.ok(Object.values(result.prerequisites).every(v=>v.status==='EVIDENCE_RECORDED'));
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.status,'BLOCKED');
});
test('B244 rejects unknown keys, secret-shaped evidence, and incomplete approvals',()=>{
 assert.throws(()=>assessHostedPrerequisites({unapproved:true}),/UNKNOWN_PREREQUISITE/);
 assert.throws(()=>assessHostedPrerequisites({approvedConsent:{status:'verified',password:'abc'}}),/INVALID_PREREQUISITE_EVIDENCE/);
 const result=assessHostedPrerequisites({approvedConsent:{status:'verified',evidenceSha256:'a'.repeat(64),approvedBy:'',approvedAt:'bad'}});
 assert.equal(result.prerequisites.approvedConsent.status,'BLOCKED');
});
