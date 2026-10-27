// Local synthetic identities only. Provider failures never contact hosted Auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {uatFixture,syntheticRoster,syntheticPassword} from './helpers/uat-fixture.mjs';
import {createUatCandidateHttp} from '../server/operations-uat-http.mjs';
const origin='https://uat.illustrative.invalid';
const mfaCookie=response=>response.headers.getSetCookie().find(value=>value.startsWith('__Host-iway-uat-mfa=')&&!value.startsWith('__Host-iway-uat-mfa=;')).split(';')[0];
async function httpFixture(t){
 const f=uatFixture();
 const handler=createUatCandidateHttp({origin,workflow:f.workflow,
  googleProvider:{authorizationUrl:()=>origin+'/synthetic-provider',exchangeCode:async()=>f.tokens(syntheticRoster[3].userId)},
  transactions:{save:async()=>{},consume:async()=>null},authorizeResource:async()=>false});
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));f.db.close();});
 const send=(path,{cookie,body={}}={})=>fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 return {...f,send};
}
test('B668 sign-out consumes a pending MFA challenge; its captured cookie cannot sign in later',async t=>{
 const f=await httpFixture(t),entry=await f.activate(1),revoked=[];
 f.provider.logout=async token=>revoked.push(token);
 const login=await f.send('/uat/password',{body:{email:entry.email,password:syntheticPassword}});assert.equal(login.status,200);
 const pending=mfaCookie(login);assert.deepEqual(await login.json(),{mfaRequired:true});
 const logout=await f.send('/uat/logout',{cookie:pending});assert.equal(logout.status,200);
 assert.equal((await f.send('/uat/mfa',{cookie:pending,body:{code:'123456'}})).status,401);
 const row=f.db.prepare('SELECT consumed,tokens FROM uat_mfa').get();assert.ok(row.consumed);assert.equal(row.tokens,null);
 assert.equal(revoked.length,1);assert.equal(f.rows.size,0);
 assert.ok(f.db.prepare("SELECT 1 FROM uat_audit WHERE event='mfa.cancelled'").get());
});
test('B668 replacing a pending sign-in invalidates the old challenge while preserving its replacement',async t=>{
 const f=await httpFixture(t),entry=await f.activate(1),body={email:entry.email,password:syntheticPassword};
 const first=await f.send('/uat/password',{body}),old=mfaCookie(first);
 const second=await f.send('/uat/password',{body,cookie:old}),next=mfaCookie(second);assert.notEqual(next,old);
 assert.equal((await f.send('/uat/mfa',{cookie:old,body:{code:'123456'}})).status,401);
 const verified=await f.send('/uat/mfa',{cookie:next,body:{code:'123456'}});assert.equal(verified.status,200);assert.equal(f.rows.size,1);
});
test('B668 expired access remains denied to resources but can refresh within its absolute lifetime',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());
 const session=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId)),read=f.sessions.get;
 let expired=true;f.sessions.get=async id=>expired?null:read(id);
 assert.equal(await f.workflow.session(session.id),null);assert.equal(f.rows.size,1);
 assert.equal((await f.workflow.sessionForRefresh(session.id)).userId,syntheticRoster[3].userId);
 const refresh=f.provider.refresh;f.provider.refresh=async token=>{const result=await refresh(token);expired=false;return result;};
 await f.workflow.refresh(session.id);assert.equal((await f.workflow.session(session.id)).role,'driver');
 f.advance(3600001);assert.equal(await f.workflow.sessionForRefresh(session.id),null);
});
test('B668 an ordinary check during refresh denies access without revoking the atomic refresh',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const session=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId));
 let release;const refresh=f.provider.refresh,read=f.sessions.get;let claimed=false;
 f.sessions.get=async id=>claimed?null:read(id);
 f.provider.refresh=async token=>{claimed=true;await new Promise(resolve=>{release=resolve;});claimed=false;return refresh(token);};
 const attempt=f.workflow.refresh(session.id);while(!release)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(await f.workflow.session(session.id),null);assert.equal(f.rows.size,1);release();
 assert.deepEqual(await attempt,{ok:true});assert.ok(await f.workflow.session(session.id));
});
test('B668 provider outage fences the local refresh session and never permits retrying its handle',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const session=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId));
 let calls=0;f.provider.refresh=async()=>{calls++;throw Error('synthetic provider outage');};
 await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(f.rows.size,0);
 assert.equal(await f.workflow.sessionForRefresh(session.id),null);
 await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(calls,1);
});
test('B668 a concurrent refresh claim loser cannot revoke the winning exchange',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const session=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId));
 let release,claimed=false,calls=0;const refresh=f.sessions.refresh,exchange=f.provider.refresh;
 f.sessions.refresh=async(id,fn)=>{if(claimed)return null;claimed=true;try{return await refresh(id,fn);}finally{claimed=false;}};
 f.provider.refresh=async token=>{calls++;await new Promise(resolve=>{release=resolve;});return exchange(token);};
 const winner=f.workflow.refresh(session.id);while(!release)await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(f.rows.size,1);release();
 assert.deepEqual(await winner,{ok:true});assert.equal(calls,1);assert.ok(await f.workflow.session(session.id));
});
test('B668 refresh cannot switch to another allowlisted identity, Google subject or lower MFA assurance',async t=>{
 for(const scenario of ['identity','google-subject','assurance']){
  const f=uatFixture();t.after(()=>f.db.close());const entry=syntheticRoster[scenario==='assurance'?1:3],session=await f.workflow.googleSession(f.tokens(entry.userId,scenario==='assurance'?'aal2':'aal1'));
  const rejected=[];f.provider.logout=async token=>rejected.push(token);
  f.provider.refresh=async()=>scenario==='identity'?f.tokens(syntheticRoster[2].userId):f.tokens(entry.userId,'aal1',scenario==='google-subject'?'unapproved-google-subject':entry.googleSubject);
  await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(f.rows.size,0);assert.equal(rejected.length,1);
 }
});
test('B668 membership revocation during provider refresh discards new tokens and denies both session paths',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=syntheticRoster[3],session=await f.workflow.googleSession(f.tokens(entry.userId));
 f.provider.refresh=async()=>{f.store.revoke(entry.userId,{deactivate:true});return f.tokens(entry.userId);};
 await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(f.rows.size,0);
 assert.equal(await f.workflow.session(session.id),null);assert.equal(await f.workflow.sessionForRefresh(session.id),null);
});
test('B668 refresh-specific authorization rejects changed tenant, principal and permission bindings',async t=>{
 for(const patch of [{tenantId:'90000000-0000-4000-8000-000000000099'},{principalId:'90000000-0000-4000-8000-000000000099'},{permissions:['load:view','load:create']}]){
  const f=uatFixture();t.after(()=>f.db.close());const entry=syntheticRoster[3],session=await f.workflow.googleSession(f.tokens(entry.userId));
  Object.assign(f.memberships.get(entry.userId),patch);assert.equal(await f.workflow.sessionForRefresh(session.id),null);
  await assert.rejects(f.workflow.refresh(session.id),/ACCESS_DENIED/);assert.equal(f.rows.size,0);
 }
});
