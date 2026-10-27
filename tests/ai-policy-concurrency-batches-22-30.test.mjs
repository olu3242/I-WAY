import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createRuntimeExtensions,claimJob,executeAdvisory,completeJob} from '../domain/operations-runtime.mjs';

const setup=async t=>{
 const f=await fixture(t,{extensions:{...createRuntimeExtensions()}});
 const reviewer=addUser(f.store,{tenantId:f.manager.tenantId,username:'policy-recovery-reviewer@illustrative.invalid',name:'Independent reviewer',role:'carrier',password});
 const load=f.assign();
 const policy={tenantId:load.tenantId,enabled:true,allowedActions:['review_dispatch'],autonomyLevel:4,minimumConfidence:1,maximumCost:0};
 const proposed=f.command(f.manager,'aipolicy:propose',null,{policy});
 const approved=f.command(reviewer,'aipolicy:approve',proposed);
 const job=f.command(f.manager,'orchestration:request',load);
 return {f,load,job,approved,reviewer};
};
const claim=(f,load,job,workerId='worker-one')=>claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId});

test('batch 22: approved policy identity is linked to atomic evidence',async t=>{
 const {f,load,job,approved}=await setup(t);
 const c=claim(f,load,job);const result=completeJob(f.ops,c,executeAdvisory(f.ops,c));
 assert.equal(result.accepted,true);
 const evidence=f.store.get('agentdecision',result.evidenceId,load.tenantId);
 assert.equal(evidence.decisionGovernance.aiDecision.policyId,approved.id);
 assert.equal(evidence.decisionGovernance.aiDecision.policyVersion,approved.version);
});
test('batch 23: competing worker cannot claim an unexpired lease',async t=>{
 const {f,load,job}=await setup(t);const first=claim(f,load,job);
 assert.ok(first);assert.equal(claim(f,load,job,'worker-two'),null);
});
test('batch 24: duplicate completion cannot duplicate immutable evidence',async t=>{
 const {f,load,job}=await setup(t);const c=claim(f,load,job),out=executeAdvisory(f.ops,c);
 assert.equal(completeJob(f.ops,c,out).accepted,true);
 assert.equal(completeJob(f.ops,c,out).accepted,false);
 assert.equal(f.store.list('agentdecision',load.tenantId).length,1);
});
test('batch 25: revocation between claim and completion denies AI approval',async t=>{
 const {f,load,job,approved}=await setup(t);const c=claim(f,load,job);
 const output=executeAdvisory(f.ops,c);
 f.command(f.manager,'aipolicy:revoke',approved);
 const done=completeJob(f.ops,c,output);
 assert.equal(done.accepted,true);
 const evidence=f.store.get('agentdecision',done.evidenceId,load.tenantId);
 assert.equal(evidence.decisionGovernance.aiDecision.status,'BLOCKED');
 assert.equal(evidence.decisionGovernance.executionPerformed,false);
});
test('batch 26: revocation does not retroactively rewrite prior immutable evidence',async t=>{
 const {f,load,job,approved}=await setup(t);const c=claim(f,load,job);
 const done=completeJob(f.ops,c,executeAdvisory(f.ops,c));
 const before=f.store.get('agentdecision',done.evidenceId,load.tenantId);
 f.command(f.manager,'aipolicy:revoke',approved);
 const after=f.store.get('agentdecision',done.evidenceId,load.tenantId);
 assert.deepEqual(after,before);
});
test('batch 27: revoked policy persists across independent store reopen',async t=>{
 const {f,approved}=await setup(t);
 const revoked=f.command(f.manager,'aipolicy:revoke',approved);
 const reopened=new OperationsStore(f.path);
 try{const persisted=reopened.get('aipolicy',revoked.id,revoked.tenantId);assert.equal(persisted.lifecycle,'REVOKED');assert.equal(persisted.enabled,false);}finally{reopened.close();}
});
test('batch 28: second store sees committed policy revocation',async t=>{
 const {f,approved}=await setup(t);
 const second=new OperationsStore(f.path);
 try{
  assert.equal(second.get('aipolicy',approved.id,approved.tenantId).enabled,true);
  f.command(f.manager,'aipolicy:revoke',approved);
  assert.equal(second.get('aipolicy',approved.id,approved.tenantId).enabled,false);
 }finally{second.close();}
});
test('batch 29: stale policy revocation is rejected after version change',async t=>{
 const {f,approved}=await setup(t);
 const revoked=f.command(f.manager,'aipolicy:revoke',approved);
 assert.throws(()=>f.command(f.manager,'aipolicy:revoke',approved),/./);
 assert.equal(f.store.get('aipolicy',revoked.id,revoked.tenantId).version,revoked.version);
});
test('batch 30: pending policy remains inert when a new store instance reads it',async t=>{
 const f=await fixture(t);
 const p=f.command(f.manager,'aipolicy:propose',null,{policy:{tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0}});
 const second=new OperationsStore(f.path);
 try{const state=new Operations(second).state(f.manager.id);assert.equal(state.aiPolicies[0].enabled,false);assert.equal(state.aiPolicies[0].lifecycle,'PENDING_APPROVAL');}finally{second.close();}
});
