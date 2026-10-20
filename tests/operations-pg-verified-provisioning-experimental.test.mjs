import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedProvisioningFlow} from '../server/operations-pg-verified-provisioning.experimental.mjs';
const issuer='https://identity.fixture.invalid';
const claims={issuer,subject:'subject-fixture',audience:'iway-test',verified:true,mfaVerified:true};
const request={invitationId:'invite',tenantId:'tenant',actorId:'actor',role:'driver',token:'opaque-test-token'};
function setup(verifier){
 const calls=[];
 const provisioner={async provision(input){calls.push(input);return {state:'ACTIVE'}}};
 return {flow:createVerifiedProvisioningFlow({provisioner,verifyIdentity:verifier,expectedAudience:'iway-test',allowedIssuers:new Set([issuer])}),calls};
}
test('trusted verified subject overrides client spoofing',async()=>{
 const {flow,calls}=setup(async()=>claims);
 assert.equal((await flow.provision({...request,issuer:'attacker',subjectHash:'bad'})).state,'ACTIVE');
 assert.equal(calls.length,1);
 assert.equal(calls[0].issuer,issuer);
 assert.equal(calls[0].subjectHash,createHash('sha256').update(claims.subject).digest('hex'));
});
for(const [name,change] of [['issuer',{issuer:'attacker'}],['audience',{audience:'wrong'}],['MFA',{mfaVerified:false}],['verified flag',{verified:false}],['subject',{subject:''}]]){
 test('rejects invalid '+name+' without provisioning',async()=>{
  const {flow,calls}=setup(async()=>({...claims,...change}));
  await assert.rejects(flow.provision(request),/IDENTITY_PROOF_REJECTED/);
  assert.equal(calls.length,0);
 });
}
test('verifier failure fails closed',async()=>{
 const {flow,calls}=setup(async()=>{throw Error('INVALID_SIGNATURE')});
 await assert.rejects(flow.provision(request),/INVALID_SIGNATURE/);
 assert.equal(calls.length,0);
});
test('missing token rejected before verification',async()=>{
 let called=false;
 const {flow,calls}=setup(async()=>{called=true;return claims});
 await assert.rejects(flow.provision({...request,token:''}),/IDENTITY_PROOF_REQUIRED/);
 assert.equal(called,false);assert.equal(calls.length,0);
});
