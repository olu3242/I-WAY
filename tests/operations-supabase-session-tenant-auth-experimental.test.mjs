import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionTenantAuthorizer} from '../server/operations-supabase-session-tenant-auth.experimental.mjs';
const id='11111111-2222-3333-4444-555555555555';
test('B465 authorizes only verified session owner with tenant role',async()=>{
 const authorize=createSessionTenantAuthorizer({
  getSession:async()=>({access_token:'private-token',user_id:id}),
  getUser:async token=>token==='private-token'?{id}:null,
  hasActiveRole:async ({userId,tenantId,role})=>userId===id&&tenantId==='tenant-a'&&role==='fleet'
 });
 assert.deepEqual(await authorize({sessionId:'opaque',tenantId:'tenant-a',role:'fleet'}),{ok:true,userId:id});
 assert.equal((await authorize({sessionId:'opaque',tenantId:'tenant-b',role:'fleet'})).ok,false);
 assert.equal((await authorize({sessionId:'opaque',tenantId:'tenant-a',role:'platform'})).ok,false);
});
test('B465 denies session identity mismatch and database outages',async()=>{
 const mismatch=createSessionTenantAuthorizer({getSession:async()=>({access_token:'token',user_id:id}),getUser:async()=>({id:'another'}),hasActiveRole:async()=>true});
 assert.equal((await mismatch({sessionId:'opaque',tenantId:'a',role:'fleet'})).ok,false);
 const outage=createSessionTenantAuthorizer({getSession:async()=>{throw Error('db down')},getUser:async()=>({id}),hasActiveRole:async()=>true});
 assert.deepEqual(await outage({sessionId:'opaque',tenantId:'a',role:'fleet'}),{ok:false,error:'ACCESS_DENIED'});
});
