import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createAutomation} from '../domain/operations-automation.mjs';
import {createRuntimeExtensions,claimJob,executeAdvisory,completeJob,runtimeIntegritySQL} from '../domain/operations-runtime.mjs';

test('governance metadata commits atomically with real agent evidence',async t=>{
 const f=await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions()}});
 f.store.db.exec(runtimeIntegritySQL);
 const load=f.assign(),job=f.command(f.manager,'orchestration:request',load);
 const claim=claimJob(f.ops,{tenantId:load.tenantId,kind:'orchestration',jobId:job.id,workerId:'governance-worker'});
 assert.ok(claim);
 const output=executeAdvisory(f.ops,claim),result=completeJob(f.ops,claim,output);
 assert.equal(result.accepted,true);
 const evidence=f.store.get('agentdecision',result.evidenceId,load.tenantId);
 assert.equal(evidence.decisionGovernance.status,'ADVISORY_ONLY');
 assert.equal(evidence.decisionGovernance.requiresWorkflowAuthorization,true);
 assert.equal(evidence.decisionGovernance.executionPerformed,false);
 assert.equal(evidence.decisionGovernance.policyVersion,evidence.policyVersion);
 assert.equal(completeJob(f.ops,claim,output).accepted,false);
 assert.equal(f.store.list('agentdecision',load.tenantId).length,1);
});
