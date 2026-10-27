import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createAIPolicyExtensions,aiPolicyIntegritySQL} from '../domain/operations-ai-policy.mjs';
import {createAutomation} from '../domain/operations-automation.mjs';
import {createRuntimeExtensions,claimJob,executeAdvisory,completeJob,runtimeIntegritySQL} from '../domain/operations-runtime.mjs';
test('proposed policy stays disabled and cannot authorize AI checkpoint',async t=>{
 const f=await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions(),...createAIPolicyExtensions()}});
 f.store.db.exec(runtimeIntegritySQL);f.store.db.exec(aiPolicyIntegritySQL);
 const load=f.assign();
 const p=f.command(f.manager,'aipolicy:propose',null,{policy:{tenantId:load.tenantId,enabled:true,allowedActions:['review_dispatch'],autonomyLevel:4,minimumConfidence:1,maximumCost:0}});
 assert.equal(p.lifecycle,'PENDING_APPROVAL');assert.equal(p.enabled,false);
 const job=f.command(f.manager,'orchestration:request',load);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'policy-test'});
 const result=completeJob(f.ops,claim,executeAdvisory(f.ops,claim));
 const decision=f.store.get('agentdecision',result.evidenceId,load.tenantId);
 assert.equal(decision.decisionGovernance.aiDecision.status,'BLOCKED');
 assert.equal(decision.decisionGovernance.executionPerformed,false);
});
