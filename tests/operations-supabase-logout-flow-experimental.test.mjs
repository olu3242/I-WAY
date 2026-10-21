import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerLogout} from '../server/operations-supabase-logout-flow.experimental.mjs';
test('B464 revokes local session even when provider logout fails',async()=>{
 const order=[];
 const logout=createServerLogout({
  getSession:async()=>({access_token:'secret'}),
  revokeSession:async()=>{order.push('local');return true;},
  revokeProviderSession:async()=>{order.push('provider');throw Error('network');},
  clearCookie:()=> 'iway_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'
 });
 const result=await logout({sessionId:'opaque'});
 assert.equal(result.ok,true);
 assert.deepEqual(order,['local','provider']);
 assert.ok(!JSON.stringify(result).includes('secret'));
});
test('B464 fails closed if local revocation fails',async()=>{
 let upstream=false;
 const logout=createServerLogout({
  getSession:async()=>({access_token:'secret'}),
  revokeSession:async()=>false,
  revokeProviderSession:async()=>{upstream=true;},
  clearCookie:()=> 'cleared'
 });
 assert.equal((await logout({sessionId:'opaque'})).ok,false);
 assert.equal(upstream,false);
 assert.equal((await logout({sessionId:''})).ok,false);
});
