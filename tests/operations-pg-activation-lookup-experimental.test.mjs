import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgActivationLookup} from '../server/operations-pg-activation-lookup.experimental.mjs';
test('lookup binds invitation and tenant and returns committed binding count',async()=>{
 let sql,params;
 const lookup=createPgActivationLookup(async(q,p)=>{
  sql=q;params=p;
  return {rowCount:1,rows:[{invitation_id:'invite',tenant_id:'tenant',state:'ACTIVE',binding_count:1}]};
 });
 assert.deepEqual(await lookup({invitationId:'invite',tenantId:'tenant'}),
  {invitationId:'invite',tenantId:'tenant',state:'ACTIVE',bindingCount:1});
 assert.deepEqual(params,['invite','tenant']);
 assert.match(sql,/b.tenant_id=i.tenant_id/);
});
test('missing activation row fails closed',async()=>{
 const lookup=createPgActivationLookup(async()=>({rowCount:0,rows:[]}));
 assert.equal(await lookup({invitationId:'missing',tenantId:'tenant'}),null);
});
