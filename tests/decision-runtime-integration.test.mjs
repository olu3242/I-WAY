import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/operations-fixture.mjs';
import { createAutomation } from '../domain/operations-automation.mjs';
import { createRuntimeExtensions, runRuntimeTick, runtimeIntegritySQL } from '../domain/operations-runtime.mjs';
import { classifyPersistedAgentDecision } from '../lib/intelligence/persisted-evidence.mjs';

test('real persisted runtime checkpoint can be classified without granting execution', async t => {
  const f = await fixture(t,{extensions:{...createAutomation(),...createRuntimeExtensions()}});
  f.store.db.exec(runtimeIntegritySQL);
  const load=f.assign();
  const job=f.command(f.manager,'orchestration:request',load);
  await runRuntimeTick(f.ops);
  const decisions=f.store.list('agentdecision',f.manager.tenantId);
  assert.ok(decisions.length>=1);
  const evidence=decisions.find(item=>item.jobId===job.id);
  assert.ok(evidence);
  const currentLoad=f.store.get('load',load.id,load.tenantId);
  const principal=f.store.principal(f.manager.id);
  const policy={tenantId:load.tenantId,enabled:true,allowedActions:['review_'+evidence.role],autonomyLevel:4,minimumConfidence:1,maximumCost:0,version:'test-only'};
  const classified=classifyPersistedAgentDecision({principal:{...principal,permissions:[...principal.permissions,'intelligence:analyze']},load:currentLoad,evidence,policy});
  assert.equal(classified.status,'APPROVAL_REQUIRED');
  assert.equal(classified.executionPerformed,false);
  assert.equal(f.store.list('agentdecision',load.tenantId).length,decisions.length);
  assert.equal(f.store.list('assignment',load.tenantId).filter(x=>x.status==='active').length,1);
});
