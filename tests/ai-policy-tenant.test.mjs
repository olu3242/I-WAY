import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
test('cross-tenant policy operations are denied and tenant state remains isolated',async t=>{
 const f=await fixture(t),p=f.command(f.manager,'aipolicy:propose',null,{policy:{tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0}});
 assert.throws(()=>f.command(f.outsider,'aipolicy:revoke',p),/./);
 assert.deepEqual(f.store.list('aipolicy',f.outsider.tenantId),[]);
 assert.deepEqual(f.ops.workspace(f.outsider.id).aiPolicies,[]);
});