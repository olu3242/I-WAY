import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedScenarios} from '../domain/operations-release.mjs';
import {runLocalHarness,runHostedScenario,installHostedTransport,evaluateObservation} from '../domain/hosted-scenario-harness.mjs';
import {evidenceFixture} from './helpers/hosted-evidence-fixture.mjs';
import {digest,canonical} from '../domain/hosted-evidence.mjs';
const h='a'.repeat(64);
const observations={
 identity:{assurance:'aal2',serverTenant:'tenant_a',revokedHttpStatus:401},
 registration:{databaseRoleRestricted:true,consentVersion:'approved-v1',approvedConsentVersion:'approved-v1',receiptId:'receipt_1',readbackReceiptId:'receipt_1'},
 persistence:{committedId:'operation_1',connectionBefore:'connection_1',connectionAfter:'connection_2',readbackId:'operation_1'},
 isolation:{ownTenant:'tenant_a',foreignReadCount:0,foreignWriteStatus:403,foreignDigestBefore:h,foreignDigestAfter:h},
 workflow:{claimId:'claim_1',renewedClaimId:'claim_1',leaseBefore:10,leaseAfter:20,recoveredClaimId:'claim_2',staleCompletionStatus:409,completionCount:1},
 integrations:{signatureValid:true,firstReceiptId:'receipt_1',duplicateReceiptId:'receipt_1',attempts:3,maximumAttempts:3,deadLetterCount:1,realDeliveryCount:0},
 rollback:{artifactDigest:h,trustedArtifactDigest:h,backupDigest:h,restoredDigest:h,healthStatus:200,auditBefore:h,auditAfter:h}
};
for(const scenario of hostedScenarios){
 test('B256 '+scenario.id+' local harness evaluates every canonical assertion without hosted promotion',async()=>{
  const r=await runLocalHarness({id:scenario.id,binding:{tenant:'tenant_a'},operation:async()=>observations[scenario.id]});
  assert.equal(r.status,'PASS');assert.equal(r.hostedExecuted,false);assert.deepEqual(Object.keys(r.checks).sort(),[...scenario.checks].sort());
 });
 test('B256 '+scenario.id+' harness rejects missing observations and fails each altered field',()=>{
  const observation=observations[scenario.id];assert.throws(()=>evaluateObservation(scenario.id,{},{}),/SCHEMA/);
  for(const field of Object.keys(observation)){
   const checks=evaluateObservation(scenario.id,{...observation,[field]:null},{tenant:'tenant_a'});
   assert.ok(Object.values(checks).some(x=>x!==true),field);
  }
 });
}
test('B256 hosted runner refuses absent/forged authorization and never calls transport',async t=>{
 const f=evidenceFixture(t);let calls=0;
 const transport=installHostedTransport({binding:f.binding,operations:Object.fromEntries(hostedScenarios.map(s=>[s.id,async()=>{calls++;return observations[s.id]}]))});
 await assert.rejects(()=>runHostedScenario({id:'identity',binding:f.binding,policy:f.policy,transport,now:f.now}),/SCHEMA/);assert.equal(calls,0);
 await assert.rejects(()=>runHostedScenario({id:'identity',binding:f.binding,policy:f.policy,authorization:f.authorization,transport:{},now:f.now}),/TRANSPORT/);assert.equal(calls,0);
});
test('B256 hosted runner contract requires scoped authorization and rechecks revocation after adapter',async t=>{
 const f=evidenceFixture(t);
 const transport=installHostedTransport({binding:f.binding,operations:Object.fromEntries(hostedScenarios.map(s=>[s.id,async()=>{f.policy.revokedAuthorizations.push('grant_one');return observations[s.id]}]))});
 await assert.rejects(()=>runHostedScenario({id:'identity',binding:f.binding,policy:f.policy,authorization:f.authorization,transport,now:f.now}),/AUTHORIZATION/);
});
test('B256 signed authorization alone is not an installed hosted transport',async t=>{
 const f=evidenceFixture(t);await assert.rejects(()=>runHostedScenario({id:'rollback',binding:f.binding,policy:f.policy,authorization:f.authorization,now:f.now}),/TRANSPORT/);
});
test('B256 unsigned observations cannot be labelled as hosted execution',async t=>{
 const f=evidenceFixture(t),transport=installHostedTransport({binding:f.binding,operations:Object.fromEntries(hostedScenarios.map(s=>[s.id,async()=>observations[s.id]]))});
 await assert.rejects(()=>runHostedScenario({id:'identity',binding:f.binding,policy:f.policy,authorization:f.authorization,transport,now:f.now}),/SCHEMA/);
});
test('B256 approved transport requires separately signed execution observations (cryptographic fixture only)',async t=>{
 const f=evidenceFixture(t);f.policy.keys.collector.purposes.push('execute:identity');
 const observation=observations.identity;
 const attestation=f.envelope('collector',{scenario:'identity',...f.binding,authorizationRef:'grant_one',observedAt:f.now(),observationSha256:digest(canonical(observation)),scope:'hosted'});
 const transport=installHostedTransport({binding:f.binding,operations:Object.fromEntries(hostedScenarios.map(s=>[s.id,async()=>({observation,attestation})]))});
 const r=await runHostedScenario({id:'identity',binding:f.binding,policy:f.policy,authorization:f.authorization,transport,now:f.now});assert.equal(r.status,'PASS');
});
