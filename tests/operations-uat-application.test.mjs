import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {uatApplicationFixture} from './helpers/uat-application-fixture.mjs';
import {syntheticPassword} from './helpers/uat-fixture.mjs';
const addCookies=(jar,response)=>{for(const value of response.headers.getSetCookie()){const [name,valuePart]=value.split(';')[0].split('=');if(valuePart)jar.set(name,valuePart);else jar.delete(name);}return jar;};
async function fixture(t,options){
 const f=await uatApplicationFixture(t,options),server=createServer(f.integrated.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const jar=new Map(),base='http://127.0.0.1:'+server.address().port;
 const send=async(path,{method='GET',body,csrf,cookies=jar,origin=f.origin,host=new URL(f.origin).host}={})=>{
  const response=await new Promise((resolve,reject)=>{const req=request(base+path,{method,headers:{host,origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(body!==undefined?{'content-type':'application/json'}:{}),...(csrf?{'x-csrf-token':csrf}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});addCookies(cookies,response);return response;
 };
 async function login(role='driver'){f.setLoginRole(role);assert.equal((await send('/auth/login',{method:'POST'})).status,303);const callback=await send('/auth/callback?code=synthetic');assert.equal(callback.status,303);return callback;}
 return {...f,send,login,jar};
}
test('OAuth callback creates a trusted native session and opens existing Operations UI for each tenant persona',async t=>{
 const f=await fixture(t);
 for(const role of ['carrier','fleet','driver']){
  const callback=await f.login(role);assert.equal(callback.headers.get('location'),'/app');assert.ok(f.jar.has('iway_ops'));assert.ok(f.jar.has('__Host-iway-session'));
  assert.equal((await f.send('/app')).status,200);const state=await f.send('/api/ops/state');assert.equal(state.status,200);const data=await state.json();assert.equal(data.actor.role,role);assert.ok(data.csrf);
  assert.equal(data.loads.length,1);assert.equal(data.loads[0].fleetId,f.fleet.id);
  assert.equal((await f.send('/api/ops/login',{method:'POST',body:{username:'synthetic',password:'synthetic'}})).status,403);
  assert.equal((await f.send('/api/ops/identity-login',{method:'POST',body:{identityToken:'synthetic'}})).status,403);
 }
});
test('platform uses a dedicated governance namespace and has no carrier Operations view',async t=>{
 const f=await fixture(t),response=await f.login('platform');assert.equal(response.headers.get('location'),'/uat/control');
 assert.equal((await f.send('/uat/control')).status,200);assert.equal((await f.send('/api/ops/state')).status,403);
 const identity=await(await f.send('/api/ops/session')).json();assert.equal(identity.actor.tenantId,f.governance);
 const audit=await f.send('/api/ops/platform',{method:'POST',body:{action:'audit'},csrf:identity.csrf});assert.equal(audit.status,200);
});
test('refresh rotates native handle and CSRF; logout invalidates both sessions and prevents replay',async t=>{
 const f=await fixture(t);await f.login();const old=new Map(f.jar),prior=await(await f.send('/api/ops/session')).json();
 const refreshed=await f.send('/uat/refresh',{method:'POST',body:{}});assert.equal(refreshed.status,200);assert.notEqual(f.jar.get('iway_ops'),old.get('iway_ops'));
 const current=await(await f.send('/api/ops/session')).json();assert.notEqual(current.csrf,prior.csrf);
 assert.equal((await f.send('/api/ops/state',{cookies:old})).status,401);
 const active=new Map(f.jar);assert.equal((await f.send('/api/ops/logout',{method:'POST',body:{},csrf:current.csrf})).status,200);
 assert.equal((await f.send('/uat/session',{cookies:active})).status,401);assert.equal((await f.send('/api/ops/state',{cookies:active})).status,401);
});
test('CSRF and changed employment deny',async t=>{
 const f=await fixture(t);await f.login('driver');
 assert.equal((await f.send('/api/ops/commands',{method:'POST',body:{}})).status,403);
 const driver=f.store.get('driver',f.driver.id,f.driver.tenantId);f.store.update('driver',driver.id,driver.tenantId,driver.version,{active:false});
 assert.equal((await f.send('/api/ops/state')).status,401);
});

test('either cookie alone, wrong host and binding revocation deny',async t=>{
 const f=await fixture(t);await f.login('driver');
 for(const name of ['iway_ops','__Host-iway-session'])assert.equal((await f.send('/api/ops/state',{cookies:new Map([[name,f.jar.get(name)]])})).status,401);
 assert.equal((await f.send('/api/ops/state',{host:'unapproved.illustrative.invalid'})).status,403);
 f.store.db.prepare('UPDATE identity_bindings SET active=0 WHERE user_id=?').run(f.driver.id);
 assert.equal((await f.send('/api/ops/state')).status,401);
});

test('platform control page rejects unapproved Host and a tenant persona',async t=>{
 const f=await fixture(t);await f.login('platform');assert.equal((await f.send('/uat/control',{host:'unapproved.illustrative.invalid'})).status,403);
 await f.login('driver');assert.equal((await f.send('/uat/control')).status,403);
});

test('password setup and Google resolve to the same existing native principal without enrollment',async t=>{
 const f=await fixture(t),entry=f.roster.find(e=>e.role==='driver');
 await f.uat.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
 await f.uat.workflow.setup({token:f.uat.mail[0].token,password:syntheticPassword,network:'synthetic'});
 const before=f.store.db.prepare('SELECT count(*) AS n FROM identity_bindings').get().n;
 assert.equal((await f.send('/uat/password',{method:'POST',body:{email:entry.email,password:syntheticPassword}})).status,200);
 const passwordIdentity=await(await f.send('/api/ops/session')).json();assert.equal(passwordIdentity.actor.id,entry.principalId);
 await f.login('driver');const googleIdentity=await(await f.send('/api/ops/session')).json();assert.equal(googleIdentity.actor.id,passwordIdentity.actor.id);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM identity_bindings').get().n,before);
});
test('native administrative revocation fences the parent and cannot be bypassed by re-bootstrap',async t=>{
 const f=await fixture(t);await f.login();const id=f.jar.get('__Host-iway-session'),native=f.jar.get('iway_ops');
 f.store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(f.driver.id);
 assert.equal((await f.send('/uat/session')).status,401);
 assert.equal((await f.send('/api/ops/state')).status,401);
 await assert.rejects(f.integrated.bridge.establish(id,native));
 assert.equal(await f.uat.workflow.session(id),null);
});

test('privileged Google AAL1 requires one-use MFA before either application session is usable',async t=>{
 for(const role of ['platform','carrier']){
  const f=await fixture(t,{googleAssurance:'aal1'}),callback=await f.login(role);
  assert.equal(callback.headers.get('location'),'/uat/login#mfa');
  assert.equal(f.jar.has('iway_ops'),false);assert.equal(f.jar.has('__Host-iway-session'),false);
  assert.equal((await f.send('/uat/session')).status,401);
  assert.equal((await f.send('/api/ops/session')).status,401);
  const pending=new Map(f.jar);
  assert.equal((await f.send('/uat/mfa',{method:'POST',body:{code:'123456'},origin:'https://unapproved.illustrative.invalid'})).status,403);
  const elevated=await f.send('/uat/mfa',{method:'POST',body:{code:'123456'}});
  assert.equal(elevated.status,200);
  assert.equal((await elevated.json()).next,role==='platform'?'/uat/control':'/app');
  const identity=await(await f.send('/api/ops/session')).json();
  assert.equal(identity.actor.id,f.roster.find(e=>e.role===role).principalId);
  assert.equal((await f.send('/uat/mfa',{method:'POST',body:{code:'123456'},cookies:pending})).status,401);
 }
});

test('native JWT expiry permits verified refresh but idle expiry still denies renewal',async t=>{
 const f=await fixture(t);await f.login('driver');
 const before=f.jar.get('iway_ops');
 f.store.db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').run(Date.now()-1,f.driver.id);
 assert.equal((await f.send('/uat/refresh',{method:'POST',body:{}})).status,200);
 assert.notEqual(f.jar.get('iway_ops'),before);
 assert.equal((await f.send('/api/ops/state')).status,200);
 f.store.db.prepare('UPDATE session_security SET last_seen_at=?').run(Date.now()-8*3600000);
 assert.equal((await f.send('/uat/refresh',{method:'POST',body:{}})).status,401);
});
