import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createAutomation} from '../domain/operations-automation.mjs';
import {createRuntimeExtensions,claimJob,executeAdvisory,completeJob,runtimeIntegritySQL} from '../domain/operations-runtime.mjs';
const setup=async t=>{const f=await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions()}});f.store.db.exec(runtimeIntegritySQL);const load=f.assign(),job=f.command(f.manager,'orchestration:request',load);return {f,load,job};};
test('disabled governance prevents claiming advisory work',async t=>{
 const {f,load,job}=await setup(t);
 f.command(f.manager,'governance:update',null,{enabled:false,disabledTools:[],reason:'Paused for review'});
 assert.equal(claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'policy-worker'}),null);
 assert.equal(f.store.list('agentdecision',load.tenantId).length,0);
});
test('policy revocation after claim blocks completion without evidence',async t=>{
 const {f,load,job}=await setup(t);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'policy-worker'});
 assert.ok(claim);
 const result=executeAdvisory(f.ops,claim);
 f.command(f.manager,'governance:update',null,{enabled:true,disabledTools:[job.plan[0].tool],reason:'Revoke this tool'});
 const completed=completeJob(f.ops,claim,result);
 assert.equal(completed.accepted,false);
 assert.equal(f.store.list('agentdecision',load.tenantId).length,0);
});
test('completed evidence records server-authorized tool and policy version',async t=>{
 const {f,load,job}=await setup(t);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'policy-worker'});
 const result=completeJob(f.ops,claim,executeAdvisory(f.ops,claim));
 assert.equal(result.accepted,true);
 const evidence=f.store.get('agentdecision',result.evidenceId,load.tenantId);
 assert.equal(evidence.decisionGovernance.allowedTool,job.plan[0].tool);
 assert.equal(evidence.decisionGovernance.policyEnabled,true);
 assert.equal(evidence.decisionGovernance.policyVersion,evidence.policyVersion);
});
