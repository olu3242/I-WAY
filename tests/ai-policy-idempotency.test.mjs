import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
test('AI policy proposal idempotency replays once and rejects altered command',async t=>{
 const f=await fixture(t),policy={tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0};
 const first=f.command(f.manager,'aipolicy:propose',null,{policy},'policy-once-0001');
 const again=f.command(f.manager,'aipolicy:propose',null,{policy},'policy-once-0001');
 assert.deepEqual(again,first);
 assert.equal(f.store.list('aipolicy',f.manager.tenantId).length,1);
 assert.throws(()=>f.command(f.manager,'aipolicy:propose',null,{policy:{...policy,maximumCost:1}},'policy-once-0001'),/./);
});