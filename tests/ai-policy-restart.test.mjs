import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
test('AI governance policy persists across independent store reopen',async t=>{
 const f=await fixture(t),policy={tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0};
 const proposed=f.command(f.manager,'aipolicy:propose',null,{policy});
 const reopened=new OperationsStore(f.path);
 try{const restored=reopened.get('aipolicy',proposed.id,proposed.tenantId);
 assert.equal(restored.enabled,false);assert.equal(restored.lifecycle,'PENDING_APPROVAL');
 assert.equal(restored.version,proposed.version);}finally{reopened.close();}
});