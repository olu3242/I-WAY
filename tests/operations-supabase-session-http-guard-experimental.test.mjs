import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionHttpGuard} from '../server/operations-supabase-session-http-guard.experimental.mjs';
const sid='s'.repeat(43);
test('B466 accepts one valid session cookie with route-owned tenant and role',async()=>{
 let seen;
 const guard=createSessionHttpGuard({authorize:async input=>{seen=input;return {ok:true,userId:'user-1'};}});
 const result=await guard({headers:{cookie:'other=abc; __Host-iway-session='+sid},tenantId:'trusted-tenant',role:'fleet'});
 assert.deepEqual(result,{ok:true,status:200,userId:'user-1'});
 assert.deepEqual(seen,{sessionId:sid,tenantId:'trusted-tenant',role:'fleet'});
});
test('B466 denies duplicate, malformed or absent cookies',async()=>{
 const guard=createSessionHttpGuard({authorize:async()=>({ok:true,userId:'user-1'})});
 for(const cookie of ['', '__Host-iway-session=short', '__Host-iway-session='+sid+'; __Host-iway-session='+sid])
  assert.equal((await guard({headers:{cookie},tenantId:'tenant',role:'fleet'})).status,401);
});
test('B466 fails closed on authorization outages and untrusted route configuration',async()=>{
 const guard=createSessionHttpGuard({authorize:async()=>{throw Error('outage');}});
 assert.equal((await guard({headers:{cookie:'__Host-iway-session='+sid},tenantId:'tenant',role:'fleet'})).status,403);
 assert.equal((await guard({headers:{cookie:'__Host-iway-session='+sid},tenantId:'',role:'fleet'})).status,403);
});
