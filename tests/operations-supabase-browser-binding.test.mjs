import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseLogin,createSupabasePkceCallback} from '../server/operations-supabase-pkce-callback-flow.experimental.mjs';
import {PKCE_COOKIE,SESSION_COOKIE,readAuthCookie,sessionCookie,clearSessionCookie} from '../server/operations-supabase-pkce-session.experimental.mjs';
const origin='https://staging.example.org',state='s'.repeat(43),other='o'.repeat(43);
test('B490.1 browser transaction is mandatory before code exchange',async()=>{
 let consumes=0,exchanges=0;
 const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:async()=>{consumes++;return {state,verifier:'v'.repeat(43)};},exchangeCode:async()=>{exchanges++;return {};},createSession:async()=>({id:'id'})});
 for(const headers of [{},{cookie:PKCE_COOKIE+'=short'},{cookie:PKCE_COOKIE+'='+state+'; '+PKCE_COOKIE+'='+other}]){
  assert.equal((await callback({url:origin+'/auth/callback?code=code&state='+state,headers})).ok,false);
 }
 assert.equal(consumes,0);assert.equal(exchanges,0);
 assert.equal((await callback({url:origin+'/auth/callback?code=code&state='+other,headers:{cookie:PKCE_COOKIE+'='+state}})).ok,false);
 assert.equal(consumes,0);
});
test('B490.1 supported code-only callback consumes browser transaction once; failure never retries',async()=>{
 for(const providerFails of [false,true]){
  let consumed=false,exchanges=0,persisted=0;
  const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:async()=>{if(consumed)return null;consumed=true;return {state,verifier:'v'.repeat(43)};},exchangeCode:async()=>{exchanges++;if(providerFails)throw Error('private-token');return {user:{id:'verified'},accessToken:'private-access',refreshToken:'private-refresh'};},createSession:async()=>{persisted++;return {id:'opaque'};}});
  const request={url:origin+'/auth/callback?code=code',headers:{cookie:PKCE_COOKIE+'='+state}};
  assert.equal((await callback(request)).ok,!providerFails);
  assert.equal((await callback(request)).ok,false);assert.equal(exchanges,1);assert.equal(persisted,providerFails?0:1);
 }
});
test('B490.1 expired transaction and provider error never exchange',async()=>{
 let exchanges=0;
 const callback=createSupabasePkceCallback({expectedOrigin:origin,consumeTransaction:async()=>null,exchangeCode:async()=>{exchanges++;},createSession:async()=>{}});
 for(const suffix of ['?code=code','?error=access_denied','?code=a&code=b','?code=code&state=bad']){
  assert.equal((await callback({url:origin+'/auth/callback'+suffix,headers:{cookie:PKCE_COOKIE+'='+state}})).ok,false);
 }
 assert.equal(exchanges,0);
});
test('B490.1 login persists verifier server-side and sends only transaction cookie and challenge',async()=>{
 let saved,challenge;
 const login=createSupabaseLogin({saveTransaction:async t=>{saved=t;},consumeTransaction:async()=>null,authorizationUrl:({challenge:c})=>{challenge=c;return 'https://provider.example/authorize?code_challenge='+c;}});
 const result=await login();
 assert.equal(result.ok,true);assert.equal(challenge,saved.challenge);
 assert.ok(result.cookie.startsWith(PKCE_COOKIE+'='+saved.state));assert.ok(!result.location.includes(saved.verifier));
 assert.match(result.cookie,/HttpOnly; Secure; SameSite=Lax/);
});
test('B490.4 canonical host-only session contract rejects duplicate and legacy cookies',()=>{
 const value='a'.repeat(43),header=sessionCookie({value});
 assert.equal(readAuthCookie({cookie:header.split(';')[0]},SESSION_COOKIE),value);
 assert.equal(readAuthCookie({cookie:'iway_session='+value},SESSION_COOKIE),null);
 assert.equal(readAuthCookie({cookie:SESSION_COOKIE+'='+value+'; '+SESSION_COOKIE+'='+value},SESSION_COOKIE),null);
 assert.match(clearSessionCookie(),new RegExp('^'+SESSION_COOKIE+'=;'));
 assert.doesNotMatch(header,/Domain=/);
});
