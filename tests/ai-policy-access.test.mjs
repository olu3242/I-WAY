import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
test('carrier governance sees policy while dispatcher does not',async t=>{
 const f=await fixture(t),p=f.command(f.manager,'aipolicy:propose',null,{policy:{tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0}});
 assert.equal(f.ops.workspace(f.manager.id).aiPolicies?.[0]?.id,p.id);
 assert.deepEqual(f.ops.workspace(f.dispatcher.id).aiPolicies,[]);
 assert.throws(()=>f.command(f.dispatcher,'aipolicy:revoke',p),/./);
});