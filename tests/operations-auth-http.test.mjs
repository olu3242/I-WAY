import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {createAuthApplication} from '../server/operations-auth-application.mjs';
import {createSupabaseLogin,createSupabasePkceCallback} from '../server/operations-supabase-pkce-callback-flow.experimental.mjs';
const origin='https://staging.example.org',user='11111111-1111-4111-8111-111111111111';
test('real HTTP login, code callback, protected access, refresh, logout and replay',async()=>{
 const tx=new Map(),rows=new Map(),events=[];let exchanges=0,operations=0;
 const transactions={save:async t=>tx.set(t.state,t),consume:async key=>{const t=tx.get(key);tx.delete(key);return t;}};
 const sessions={create:async data=>{const id=randomBytes(32).toString('base64url');rows.set(id,data);return {id};},
 get:async id=>{const row=rows.get(id);return row?{user_id:row.userId,access_token:row.accessToken}:null;},
 revoke:async id=>rows.delete(id),refresh:async(id,refresh)=>{const row=rows.get(id);if(!row)return null;const tokens=await refresh(row.refreshToken);rows.set(id,{userId:tokens.user.id,...tokens});return {id,maxAge:300};}};
 const provider={authorizationUrl:({challenge})=>'https://provider.example/authorize?code_challenge='+challenge,
 exchangeCode:async()=>{exchanges++;return {user:{id:user},accessToken:'secret-access',refreshToken:'secret-refresh'};},
 getUser:async()=>({id:user}),refresh:async()=>({user:{id:user},accessToken:'next-secret',refreshToken:'next-refresh'}),logout:async()=>{throw Error('provider outage');}};
 const app=createAuthApplication({origin,provider,transactions,sessions,observe:event=>events.push(event),authorizeResource:async({resourceId})=>{if(resourceId==='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'){operations++;return true;}return false;}});
 const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const send=(path,method='GET',cookie)=>fetch(base+path,{method,redirect:'manual',headers:{origin,...(cookie?{cookie}:{})}});
 try{
  assert.equal((await send('/auth/login','GET')).status,401);
  assert.equal((await fetch(base+'/auth/login',{method:'POST',headers:{origin:'https://evil.example'}})).status,403);
  let r=await send('/auth/login','POST');assert.equal(r.status,303);assert.match(r.headers.get('x-request-id'),/^[0-9a-f-]{36}$/);
  const binding=r.headers.getSetCookie()[0].split(';')[0];
  r=await send('/auth/callback?code=valid');assert.equal(r.status,401);assert.equal(exchanges,0);
  r=await send('/auth/callback?code=valid','GET',binding);assert.equal(r.status,303);
  const cookie=r.headers.getSetCookie().find(x=>x.startsWith('__Host-iway-session=')).split(';')[0];
  assert.ok(!cookie.includes('secret'));assert.equal((await r.text()).includes('secret'),false);
  assert.equal((await send('/auth/callback?code=valid','GET',binding)).status,401);assert.equal(exchanges,1);
  assert.equal((await send('/auth/session','GET',cookie)).status,200);
  assert.equal((await send('/api/resources/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/verify','GET',cookie)).status,200);
  assert.equal((await send('/api/resources/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verify','GET',cookie)).status,403);
  assert.equal(operations,1);
  assert.equal((await send('/auth/session','GET',cookie+'; '+cookie)).status,401);
  r=await send('/auth/refresh','POST',cookie);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('next-secret'));
  // Reauthentication cannot preserve an attacker-chosen or previous session handle.
  const relogin=await send('/auth/login','POST',cookie);
  const nextBinding=relogin.headers.getSetCookie()[0].split(';')[0];
  const replacement=await send('/auth/callback?code=new','GET',nextBinding+'; '+cookie);
  assert.equal(replacement.status,303);
  const replacementCookie=replacement.headers.getSetCookie().find(x=>x.startsWith('__Host-iway-session=')).split(';')[0];
  assert.notEqual(replacementCookie,cookie);assert.equal((await send('/auth/session','GET',cookie)).status,401);
  assert.equal((await fetch(base+'/auth/refresh',{method:'POST',headers:{origin:'https://evil.example',cookie:replacementCookie}})).status,403);
  assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers:{origin,cookie:replacementCookie,'sec-fetch-site':'cross-site'}})).status,403);
  const originalUser=provider.getUser;provider.getUser=async()=>({id:'22222222-2222-4222-8222-222222222222'});
  assert.equal((await send('/auth/session','GET',replacementCookie)).status,403);
  provider.getUser=async()=>{throw Error('secret-provider-outage');};
  const unavailable=await send('/auth/session','GET',replacementCookie);assert.equal(unavailable.status,503);assert.equal((await unavailable.text()).includes('secret'),false);
  provider.getUser=originalUser;
  assert.equal((await send('/auth/logout','POST',replacementCookie)).status,200);
  assert.equal((await send('/auth/session','GET',cookie)).status,401);
  r=await fetch(base+'/auth/login',{method:'POST',headers:{origin},body:'unexpected'});assert.equal(r.status,413);
  assert.ok(events.length>10);assert.equal(JSON.stringify(events).includes('secret'),false);assert.equal(events.some(e=>e.route==='resource.verify'&&e.status===403),true);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
