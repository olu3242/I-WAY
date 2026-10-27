import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {ownerProfilesFixture} from './helpers/owner-profiles-fixture.mjs';
import {validateOwnerProfiles} from '../server/operations-owner-profiles.mjs';
async function fixture(t){
 const f=await ownerProfilesFixture(t),server=createServer(f.app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const jar=new Map();
 async function send(path,{method='GET',body,csrf,cookies=jar,origin=f.origin}={}){
  const data=body===undefined?undefined:JSON.stringify(body);
  const r=await new Promise((resolve,reject)=>{const q=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{host:new URL(f.origin).host,origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...(csrf?{'x-csrf-token':csrf}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});q.on('error',reject);q.end(data);});
  for(const c of r.headers['set-cookie']??[]){const [k,v]=c.split(';')[0].split('=');if(v)cookies.set(k,v);else cookies.delete(k);}return {...r,json:()=>JSON.parse(r.text)};
 }
 async function login(role){f.setLoginRole(role);assert.equal((await send('/auth/login',{method:'POST'})).status,303);assert.equal((await send('/auth/callback?code=synthetic')).status,303);}
 return {...f,send,login,jar};
}
for(const role of ['platform','driver'])test('owner '+role+' switches all four profiles with scoped identity, MFA and audit',async t=>{
 const f=await fixture(t);await f.login(role);
 const picker=(await f.send('/uat/profiles/session')).json();assert.equal(picker.profiles.length,4);
 for(const p of f.profiles.filter(p=>p.ownerUserId===f.roster.find(e=>e.role===role).userId)){
  const switched=await f.send('/uat/profiles/switch',{method:'POST',csrf:picker.csrf,body:{profileId:p.principalId}});assert.equal(switched.status,200,switched.text);
  const session=await f.send('/api/ops/session');assert.equal(session.status,200,session.text);assert.equal(session.json().actor.role,p.role);assert.equal(session.json().actor.ownerUserId,p.ownerUserId);
  const page=await f.send(p.role==='platform'?'/uat/control':'/app');assert.equal(page.status,200);assert.match(page.text,/Switch profile/);
  const result=await f.send('/api/ops/platform',{method:'POST',csrf:session.json().csrf,body:{action:'audit'}});assert.equal(result.status,p.role==='platform'?200:403);
 }
 const audits=f.store.db.prepare("SELECT detail FROM audit WHERE action='profile:switch'").all();assert.equal(audits.length,4);assert.ok(audits.every(a=>JSON.parse(a.detail).authenticatedOwnerUserId));
 const platformAudit=f.store.db.prepare("SELECT detail FROM audit WHERE action='platform:audit' ORDER BY sequence DESC LIMIT 1").get();assert.ok(JSON.parse(platformAudit.detail).authenticatedOwnerUserId);
});
test('switch denies non-owner, cross-owner grants, CSRF, forged cookie and stale CSRF; logout fences selected profile',async t=>{
 const f=await fixture(t);await f.login('carrier');assert.equal((await f.send('/uat/profiles/session')).status,403);
 await f.login('platform');const picker=(await f.send('/uat/profiles/session')).json(),target=f.profiles.find(p=>p.ownerUserId===f.roster[0].userId&&p.role==='driver');
 const switchTo=(id,csrf=picker.csrf)=>f.send('/uat/profiles/switch',{method:'POST',csrf,body:{profileId:id}});
 assert.equal((await switchTo(target.principalId,'bad')).status,403);
 assert.equal((await switchTo(f.profiles.find(p=>p.ownerUserId===f.roster[3].userId).principalId)).status,403);
 assert.equal((await switchTo(target.principalId)).status,200);const prior=(await f.send('/api/ops/session')).json();
 assert.equal((await switchTo(target.principalId)).status,200);
 assert.equal((await f.send('/api/ops/commands',{method:'POST',csrf:prior.csrf,body:{}})).status,403);
 const forged=new Map(f.jar);forged.set('__Host-iway-profile','x'.repeat(43));assert.equal((await f.send('/api/ops/session',{cookies:forged})).status,409);
 const base=(await f.send('/uat/profiles/session')).json();assert.equal((await f.send('/api/ops/logout',{method:'POST',csrf:base.csrf,body:{}})).status,200);
 assert.equal((await f.send('/api/ops/session')).status,401);
});
test('approved profile manifest cannot reuse another tester or widen tenant scope',async t=>{
 const f=await fixture(t);for(const mutate of [p=>p[0].principalId=f.roster[1].principalId,p=>p[1].tenantId=f.governance,p=>p[0].permissions=['load:create']]){const profiles=structuredClone(f.profiles);mutate(profiles);assert.throws(()=>validateOwnerProfiles(profiles,f.roster,f.governance));}
});
test('owner AAL1 sessions are not admitted and inactive profile principals cannot execute',async t=>{
 const f=await fixture(t);const result=await f.dependencies.workflow.googleSession(f.uat.tokens(f.roster[3].userId,'aal1'));assert.equal(result.mfaRequired,true);
 await f.login('platform');const picker=(await f.send('/uat/profiles/session')).json(),target=f.profiles.find(p=>p.ownerUserId===f.roster[0].userId&&p.role==='carrier');
 assert.equal((await f.send('/uat/profiles/switch',{method:'POST',csrf:picker.csrf,body:{profileId:target.principalId}})).status,200);
 const actor=f.store.principal(target.principalId);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...actor,active:false}),actor.id);
 assert.equal((await f.send('/api/ops/session')).status,403);
});
