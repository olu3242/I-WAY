import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
test('approved AI policy revocation is immediate and versioned',async t=>{
 const f=await fixture(t);
 const approver=addUser(f.store,{tenantId:f.manager.tenantId,username:'approval3@illustrative.invalid',name:'Second Carrier Approver',role:'carrier',password});
 const policy={tenantId:f.manager.tenantId,enabled:true,allowedActions:['review_tracking'],autonomyLevel:4,minimumConfidence:1,maximumCost:0};
 const proposed=f.command(f.manager,'aipolicy:propose',null,{policy});
 const approved=f.command(approver,'aipolicy:approve',proposed);
 const revoked=f.command(f.manager,'aipolicy:revoke',approved);
 assert.equal(revoked.enabled,false);assert.equal(revoked.lifecycle,'REVOKED');
 assert.equal(revoked.version,approved.version+1);
 assert.throws(()=>f.command(approver,'aipolicy:approve',revoked),/./);
});