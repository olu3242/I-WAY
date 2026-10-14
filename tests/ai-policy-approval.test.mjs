import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
test('two distinct carrier principals approve a tenant policy',async t=>{
 const f=await fixture(t);
 const approver=addUser(f.store,{tenantId:f.manager.tenantId,username:'approval2@illustrative.invalid',name:'Second Carrier Approver',role:'carrier',password});
 const policy={tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_dispatch'],autonomyLevel:4,minimumConfidence:1,maximumCost:0};
 const proposed=f.command(f.manager,'aipolicy:propose',null,{policy});
 assert.throws(()=>f.command(f.manager,'aipolicy:approve',proposed),/./);
 const approved=f.command(approver,'aipolicy:approve',proposed);
 assert.equal(approved.lifecycle,'APPROVED');assert.equal(approved.enabled,true);
 assert.equal(approved.approvedBy,approver.id);
});