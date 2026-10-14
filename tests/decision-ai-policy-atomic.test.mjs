import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createAutomation} from '../domain/operations-automation.mjs';
import {createRuntimeExtensions,claimJob,executeAdvisory,completeJob,runtimeIntegritySQL} from '../domain/operations-runtime.mjs';
test('missing AI policy is explicitly blocked in atomic evidence, without blocking legacy advisory',async t=>{
 const f=await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions()}});
 f.store.db.exec(runtimeIntegritySQL);
 const load=f.assign(),job=f.command(f.manager,'orchestration:request',load);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'ai-policy-worker'});
 const result=completeJob(f.ops,claim,executeAdvisory(f.ops,claim));
 assert.equal(result.accepted,true);
 const evidence=f.store.get('agentdecision',result.evidenceId,load.tenantId);
 assert.equal(evidence.decisionGovernance.aiDecision.status,'BLOCKED');
 assert.equal(evidence.decisionGovernance.aiDecision.reason,'AI_POLICY_NOT_CONFIGURED');
 assert.equal(evidence.decisionGovernance.executionPerformed,false);
});
test('tenant AI policy remains disabled unless provisioned; legacy governance does not silently enable it',async t=>{
 const f=await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions()}});
 f.store.db.exec(runtimeIntegritySQL);
 const load=f.assign();
 f.command(f.manager,'governance:update',null,{enabled:true,disabledTools:[],reason:'Legacy automation permitted'});
 const job=f.command(f.manager,'orchestration:request',load);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'ai-policy-worker'});
 const result=completeJob(f.ops,claim,executeAdvisory(f.ops,claim));
 assert.equal(f.store.get('agentdecision',result.evidenceId,load.tenantId).decisionGovernance.aiDecision.status,'BLOCKED');
});
