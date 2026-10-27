import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
test('AI policy stale version and wrong record identity are rejected',async t=>{
 const f=await fixture(t),p=f.command(f.manager,'aipolicy:propose',null,{policy:{tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0}});
 assert.throws(()=>f.command(f.manager,'aipolicy:revoke',{...p,version:p.version-1}),/./);
 assert.throws(()=>f.command(f.manager,'aipolicy:revoke',{...p,id:'other-policy'}),/./);
 assert.equal(f.store.get('aipolicy',p.id,p.tenantId).lifecycle,'PENDING_APPROVAL');
});