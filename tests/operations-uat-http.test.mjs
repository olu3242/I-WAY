import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {uatFixture,syntheticRoster,syntheticPassword} from './helpers/uat-fixture.mjs';
import {createUatCandidateHttp} from '../server/operations-uat-http.mjs';
import {authorize} from '../domain/authorization.mjs';
const origin='https://uat.illustrative.invalid',own='90000000-0000-4000-8000-000000000030',cross='90000000-0000-4000-8000-000000000031';
async function fixture(t,{decorateWorkflow=w=>w}={}){
 const f=uatFixture(),transactions=new Map();
 const handler=createUatCandidateHttp({origin,workflow:decorateWorkflow(f.workflow),
  googleProvider:{authorizationUrl:({challenge})=>'https://provider.illustrative.invalid/authorize?code_challenge='+challenge,exchangeCode:async()=>f.tokens(syntheticRoster[3].userId)},
  transactions:{save:async tx=>transactions.set(tx.state,tx),consume:async key=>{const tx=transactions.get(key);transactions.delete(key);return tx;}},
  authorizeResource:async({actor,resourceId})=>authorize({actor,action:'load:view',resource:{kind:'load',tenantId:resourceId===own?syntheticRoster[3].tenantId:'90000000-0000-4000-8000-000000000011',fleetId:syntheticRoster[3].fleetId,driverId:syntheticRoster[3].principalId}})});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));f.db.close();});
 const send=(path,{method='GET',body,cookie,requestOrigin=origin}={})=>fetch(base+path,{method,redirect:'manual',headers:{origin:requestOrigin,...(cookie?{cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return {...f,send,base};
}
const cookie=response=>response.headers.getSetCookie().find(c=>c.startsWith('__Host-iway-session=')).split(';')[0];
test('local HTTP Google PKCE initiation, callback, replay, session, refresh, cross-tenant denial and logout',async t=>{
 const f=await fixture(t);const start=await f.send('/auth/login',{method:'POST'});assert.equal(start.status,303);
 assert.match(start.headers.get('location'),/code_challenge=/);const binding=start.headers.getSetCookie()[0].split(';')[0];
 assert.equal((await f.send('/auth/callback?code=synthetic')).status,401);
 const callback=await f.send('/auth/callback?code=synthetic',{cookie:binding});assert.equal(callback.status,200);const session=cookie(callback);
 assert.equal((await f.send('/auth/callback?code=synthetic',{cookie:binding})).status,401);
 assert.equal((await f.send('/uat/session',{cookie:session})).status,200);
 assert.equal((await f.send('/uat/resources/'+own,{cookie:session})).status,200);
 assert.equal((await f.send('/uat/resources/'+cross,{cookie:session})).status,403);
 assert.equal((await f.send('/uat/refresh',{method:'POST',cookie:session,body:{}})).status,200);
 assert.equal((await f.send('/uat/logout',{method:'POST',cookie:session,body:{}})).status,200);
 assert.equal((await f.send('/uat/session',{cookie:session})).status,401);
});
test('HTTP setup and password sessions expose opaque cookies only; reauthentication rotates handles',async t=>{
 const f=await fixture(t),entry=syntheticRoster[3];
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
 const setup=await f.send('/uat/setup',{method:'POST',body:{token:f.mail[0].token,password:syntheticPassword}});assert.equal(setup.status,200);assert.equal(setup.headers.get('set-cookie'),null);
 const login=await f.send('/uat/password',{method:'POST',body:{email:entry.email,password:syntheticPassword}});assert.equal(login.status,200);assert.deepEqual(await login.json(),{ok:true});
 const first=cookie(login);assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const second=await f.send('/uat/password',{method:'POST',cookie:first,body:{email:entry.email,password:syntheticPassword}});assert.notEqual(cookie(second),first);
 assert.equal((await f.send('/uat/session',{cookie:first})).status,401);
 assert.equal((await f.send('/uat/password',{method:'POST',body:{email:'fifth@illustrative.invalid',password:syntheticPassword}})).status,401);
});
test('HTTP MFA pending credentials stay HttpOnly and user-provided role/tenant claims grant nothing',async t=>{
 const f=await fixture(t),entry=await f.activate(1);
 const response=await f.send('/uat/password',{method:'POST',body:{email:entry.email,password:syntheticPassword,role:'platform',tenantId:'forged'}});assert.deepEqual(await response.json(),{mfaRequired:true});
 const pending=response.headers.getSetCookie().find(c=>c.startsWith('__Host-iway-uat-mfa=')).split(';')[0];assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
 const elevated=await f.send('/uat/mfa',{method:'POST',cookie:pending,body:{code:'123456'}});assert.equal(elevated.status,200);
 const identity=await f.send('/uat/session',{cookie:cookie(elevated)});assert.deepEqual(await identity.json(),{authenticated:true,role:'carrier'});
 assert.equal((await f.send('/uat/mfa',{method:'POST',cookie:pending,body:{code:'123456'}})).status,401);
});
test('CSRF, query credentials, oversized bodies and malformed framing deny before provider access',async t=>{
 const f=await fixture(t);await f.activate();
 assert.equal((await f.send('/uat/password',{method:'POST',requestOrigin:'https://attacker.invalid',body:{}})).status,403);
 assert.equal((await f.send('/uat/password?password=synthetic',{method:'POST',body:{}})).status,400);
 assert.equal((await f.send('/uat/password',{method:'POST',body:{password:'x'.repeat(5000)}})).status,413);
 assert.equal((await fetch(f.base+'/uat/password',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'synthetic'})).status,413);
 assert.equal((await f.send('/uat/issue',{method:'POST',body:{role:'platform'}})).status,404);
 const denied=await f.send('/uat/password',{method:'POST',body:{email:'fifth@illustrative.invalid',password:randomBytes(16).toString('hex')}});assert.equal(denied.status,401);
 assert.deepEqual(await denied.json(),{error:'ACCESS_DENIED'});
});
test('failed previous-session revocation also revokes the new orphan session',async t=>{
 const old='A'.repeat(43),f=await fixture(t,{decorateWorkflow:workflow=>({...workflow,logout:async id=>{if(id===old)throw Error('synthetic storage outage');return workflow.logout(id);}})});
 const entry=await f.activate();
 const result=await f.send('/uat/password',{method:'POST',cookie:'__Host-iway-session='+old,body:{email:entry.email,password:syntheticPassword}});
 assert.equal(result.status,401);assert.equal(f.rows.size,0);
});
