import test from 'node:test';
import assert from 'node:assert/strict';
import {withSopTransaction,requireSopIdentity} from '../transaction-context.mjs';
const identity={verified:true,tenantMembershipVerified:true,subjectId:'actor1',tenantId:'tenant1'};
function pool(handler=()=>({})){const calls=[];let releases=0;return {calls,get releases(){return releases},async connect(){return {async query(sql,args){calls.push({sql,args});return handler(sql,args)},release(){releases++}}}}}
test('B5 rejects missing or unverified identity before connecting',async()=>{
 const p=pool();
 await assert.rejects(()=>withSopTransaction(p,{...identity,verified:false},()=>{}),/SOP_VERIFIED_IDENTITY_REQUIRED/);
 assert.equal(p.calls.length,0);
});
test('B5 binds transaction-local actor and tenant with parameters',async()=>{
 const p=pool();
 await withSopTransaction(p,identity,async()=>{});
 assert.deepEqual(p.calls.map(x=>x.sql),['BEGIN','SELECT set_config($1,$2,true),set_config($3,$4,true)','COMMIT']);
 assert.deepEqual(p.calls[1].args,['iway.verified_tenant','tenant1','iway.verified_actor','actor1']);
 assert.equal(p.releases,1);
});
test('B5 rolls back and releases connection on failure',async()=>{
 const p=pool();
 await assert.rejects(()=>withSopTransaction(p,identity,async()=>{throw Error('failure')}),/failure/);
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');
 assert.equal(p.releases,1);
});
test('B5 rejects malformed identity',()=>assert.throws(()=>requireSopIdentity({...identity,tenantId:'bad tenant'})));
