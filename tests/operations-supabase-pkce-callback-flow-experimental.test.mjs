import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabasePkceCallback} from '../server/operations-supabase-pkce-callback-flow.experimental.mjs';
const origin='https://staging.example.org',state='s'.repeat(43);
test('B454 consumes one-time PKCE state and persists session only server-side',async()=>{
 const transactions=new Map([[state,{state,verifier:'v'.repeat(43)}]]);
 let exchanges=0;
 const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:async key=>{const v=transactions.get(key);transactions.delete(key);return v;},exchangeCode:async()=>{exchanges++;return {user:{id:'user'},accessToken:'private-access',refreshToken:'private-refresh'};},createSession:async()=>({id:'opaque-session-id'})});
 const url=origin+'/auth/callback?code=valid&state='+state;
 assert.deepEqual(await callback({url}),{ok:true,sessionId:'opaque-session-id'});
 assert.deepEqual(await callback({url}),{ok:false,error:'AUTH_CALLBACK_REJECTED'});
 assert.equal(exchanges,1);
});
test('B454 denies absent transaction and callback origin mismatch',async()=>{
 const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:async()=>null,exchangeCode:async()=>{throw Error('should not exchange')},createSession:async()=>{throw Error('should not persist')}});
 assert.equal((await callback({url:origin+'/auth/callback?code=valid&state='+state})).ok,false);
 assert.equal((await callback({url:'https://evil.example/auth/callback?code=valid&state='+state})).ok,false);
});

test('B461 invalid origin or code does not consume a legitimate PKCE transaction',async()=>{
 const transactions=new Map([[state,{state,verifier:'v'.repeat(43)}]]);
 let consumed=0;
 const callback=createSupabasePkceCallback({
  expectedOrigin:origin,
  consumeTransaction:async key=>{consumed++;const item=transactions.get(key);transactions.delete(key);return item;},
  exchangeCode:async()=>({user:{id:'user'},accessToken:'access',refreshToken:'refresh'}),
  createSession:async()=>({id:'opaque'})
 });
 assert.equal((await callback({url:'https://evil.example/auth/callback?code=valid&state='+state})).ok,false);
 assert.equal((await callback({url:origin+'/auth/callback?state='+state})).ok,false);
 assert.equal(consumed,0);
 assert.equal((await callback({url:origin+'/auth/callback?code=valid&state='+state})).ok,true);
 assert.equal(consumed,1);
});
