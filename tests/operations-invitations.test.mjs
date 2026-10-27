import {createOperationsAdmin} from '../server/operations-admin.mjs';
import {Worker} from 'node:worker_threads';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {invitationFixture} from './helpers/invitation-fixture.mjs';
import {authenticateIdentity,revokeSessions} from '../server/operations-identity.mjs';
import {authenticate} from '../server/operations-auth.mjs';
import {readSession} from '../server/operations-identity.mjs';
import {createInvitationService,createMockInvitationTransport} from '../server/operations-invitations.mjs';
import {platformGovernance} from '../server/operations-platform.mjs';
import {authorize} from '../domain/authorization.mjs';
import {password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';
// All recipients, subjects and signing keys are isolated synthetic fixtures.
const denied=(fn,code)=>assert.throws(fn,e=>e.code===code);
function send(f,auth,input){const invite=f.service.create(auth,input);f.service.send(auth,invite.id,randomUUID());return {invite,token:f.transport.messages.at(-1).token};}
test('four personas enroll, first-login, scoped access and platform MFA over real HTTP',async t=>{
 const f=await invitationFixture(t),logs=[];
 const app=makeOperationsApp({store:f.store,operations:f.ops,identityVerifier:f.verifier,invitationTransport:f.transport,logSink:v=>logs.push(v)});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
 const base='http://127.0.0.1:'+app.address().port;
 const post=async(path,body,auth)=>{const r=await fetch(base+'/api/ops/'+path,{method:'POST',headers:{origin:base,'content-type':'application/json',...(auth?{cookie:'iway_ops='+auth.token,'x-csrf-token':auth.csrf}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 for(const role of ['carrier','fleet','driver','platform']){
  const reviewer=role==='platform'?f.platformAuth():f.auth(role==='driver'?f.fleetUser:f.manager);
  const input=f.input(role,{...(['fleet','driver'].includes(role)?{fleetId:f.fleet.id}:{})});
  const created=await post('invitations/create',input,reviewer);assert.equal(created.status,201,JSON.stringify(created));
  assert.equal((await post('invitations/send',{id:created.body.id,key:randomUUID()},reviewer)).status,200);
  const secret=f.transport.messages.at(-1).token;
  assert.equal((await post('invitations/open',{token:secret})).body.state,'OPENED');
  const accepted=await post('invitations/accept',{token:secret,identityToken:f.token(input.subject,{user_metadata:{role:'carrier',tenantId:f.outsider.tenantId}})});
  assert.equal(accepted.status,200,JSON.stringify(accepted));assert.equal(accepted.body.state,'ACTIVE');
  const response=await post('identity-login',{identityToken:f.token(input.subject)});assert.equal(response.status,200);
  const login=readSession(f.store,response.cookie.split(';')[0].slice(9),Date.now());
  const loginToken=response.cookie.split(';')[0].slice(9);
  assert.equal(login.actor.role,role);assert.equal(login.actor.tenantId,reviewer.actor.tenantId);
  const own={tenantId:login.actor.tenantId,fleetId:f.fleet.id,driverId:login.actor.id};
  assert.equal(authorize({actor:login.actor,action:'load:view',resource:own}),role!=='platform');
  assert.equal(authorize({actor:login.actor,action:'load:view',resource:{...own,tenantId:f.outsider.tenantId}}),false);
  if(role==='driver'){assert.equal(f.store.get('driver',login.actor.id,login.actor.tenantId).approved,false);assert.equal(authorize({actor:login.actor,action:'load:view',resource:{...own,driverId:f.driver.id}}),false);}
  if(role==='fleet')assert.equal(authorize({actor:login.actor,action:'asset:manage',resource:{...own,fleetId:'unrelated'}}),false);
  if(role==='platform'){
   assert.ok(platformGovernance(f.store,login,{action:'audit'},Date.now()).length);
   denied(()=>f.ops.state(login.actor.id),'FORBIDDEN');
   denied(()=>authenticateIdentity(f.store,f.verifier,f.token(input.subject,{aal:'aal1'}),f.now()),'MFA_REQUIRED');
   denied(()=>authenticate(f.store,login.actor.username,password,f.now()),'LOGIN');
  }
  assert.equal(readSession(f.store,loginToken,f.now()+8*3600000),null);
 }
 const audit=f.store.db.prepare("SELECT action FROM audit WHERE action LIKE 'invitation:%'").all().map(r=>r.action);
 for(const state of ['created','sent','opened','verified','accepted','active'])assert.equal(audit.filter(x=>x==='invitation:'+state).length,4);
 const persisted=JSON.stringify(f.store.db.prepare('SELECT * FROM invitations').all())+JSON.stringify(logs)+JSON.stringify(f.store.db.prepare('SELECT * FROM audit').all());
 for(const message of f.transport.messages)assert.ok(!persisted.includes(message.token));
});
test('expiration, replay, identity mismatch, invalid claims and duplicate accounts fail closed',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input(),sent=send(f,auth,input);
 denied(()=>f.service.create(auth,input),'INVITATION_EXISTS');
 denied(()=>f.service.accept(sent.token,f.token('other-subject')),'IDENTITY');
 for(const claim of [{iss:'https://wrong.invalid'},{aud:'wrong'},{exp:0},{iat:Math.floor(f.now()/1000)+500}])denied(()=>f.service.accept(sent.token,f.token(input.subject,claim)),'IDENTITY');
 const result=f.service.accept(sent.token,f.token(input.subject));assert.equal(result.state,'ACTIVE');
 denied(()=>f.service.accept(sent.token,f.token(input.subject)),'INVITATION');
 denied(()=>f.service.create(auth,{...input,subject:'another-subject'}),'ACCOUNT_EXISTS');
 const expired=send(f,auth,f.input());f.advance(120001);
 assert.equal(f.service.inspect(auth,expired.invite.id).state,'EXPIRED');denied(()=>f.service.accept(expired.token,f.token('any')),'INVITATION');
});
test('resend is idempotent and bounded; old tokens, revoked and rejected invites cannot activate',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input();const invite=f.service.create(auth,input);
 f.service.send(auth,invite.id,'delivery-one');const old=f.transport.messages.at(-1).token;
 f.service.send(auth,invite.id,'delivery-one');assert.equal(f.transport.messages.length,1);
 denied(()=>f.service.send(auth,invite.id,'delivery-two'),'RATE_LIMIT');
 f.advance(60001);f.service.send(auth,invite.id,'delivery-two');const fresh=f.transport.messages.at(-1).token;
 denied(()=>f.service.open(old),'INVITATION');assert.equal(f.service.open(fresh).state,'OPENED');
 f.service.revoke(auth,invite.id);denied(()=>f.service.accept(fresh,f.token(input.subject)),'INVITATION');
 const another=send(f,auth,f.input());assert.equal(f.service.reject(another.token).state,'REJECTED');denied(()=>f.service.open(another.token),'INVITATION');
});
test('delivery failure can recover without plaintext persistence; unconfigured transport is disabled',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input();
 const failed=createInvitationService(f.store,{verifier:f.verifier,transport:createMockInvitationTransport({fail:true}),now:f.now});
 const invite=failed.create(auth,input);assert.equal(failed.send(auth,invite.id,'failed-send').state,'FAILED');
 assert.equal(f.store.db.prepare('SELECT token_hash FROM invitations WHERE id=?').get(invite.id).token_hash,null);
 f.advance(60001);assert.equal(f.service.send(auth,invite.id,'retry').state,'SENT');
 const disabled=createInvitationService(f.store,{verifier:f.verifier});denied(()=>disabled.send(auth,invite.id,'disabled'),'DELIVERY_DISABLED');
});
test('reviewer authority, tenant relationships, session revocation and escalation are rechecked',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),fleet=f.auth(f.fleetUser);
 denied(()=>f.service.create({...auth},f.input()),'SESSION');
 denied(()=>f.service.create(auth,f.input('platform',{permissions:[]})),'FORBIDDEN');
 denied(()=>f.command(f.manager,'user:create',null,{username:'p@illustrative.invalid',name:'No',password,role:'platform',permissions:[]}),'FORBIDDEN');
 denied(()=>f.service.create(fleet,f.input('carrier')),'FORBIDDEN');
 denied(()=>f.service.create(auth,f.input('fleet',{fleetId:'other'})),'NOT_FOUND');
 const x=send(f,auth,f.input());denied(()=>f.service.inspect(f.auth(f.outsider),x.invite.id),'NOT_FOUND');
 const update={...f.manager,permissions:[]};f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(update),update.id);
 denied(()=>f.service.accept(x.token,f.token('any')),'AUTHORITY_CHANGED');
 denied(()=>f.command(f.outsider,'user:deactivate',f.outsider,{reason:'cannot suspend self'}),'USER');
});
test('account suspension and revoked reviewer sessions immediately block login and invitation administration',async t=>{
 const f=await invitationFixture(t),driverSession=f.auth(f.driver),auth=f.auth(f.manager);
 f.command(f.manager,'user:deactivate',f.driver,{reason:'Synthetic suspension'});
 assert.equal(readSession(f.store,driverSession.token,f.now()),null);denied(()=>f.auth(f.driver),'LOGIN');
 revokeSessions(f.store,f.manager,f.manager.id,'Synthetic revocation');denied(()=>f.service.create(auth,f.input()),'SESSION');
 const platform=f.platformAuth();denied(()=>platformGovernance(f.store,{...platform},{action:'audit'},f.now()),'SESSION');
});
test('transaction failure rolls back enrollment and allows safe retry; audit is append only',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input(),x=send(f,auth,input);
 const audit=f.store.audit;f.store.audit=()=>{throw Error('Synthetic database outage');};
 assert.throws(()=>f.service.accept(x.token,f.token(input.subject)),/Synthetic database outage/);
 f.store.audit=audit;assert.equal(f.store.db.prepare('SELECT 1 FROM users WHERE username=?').get(input.recipient),undefined);
 assert.equal(f.service.accept(x.token,f.token(input.subject)).state,'ACTIVE');
 assert.throws(()=>f.store.db.exec('UPDATE audit SET outcome=outcome'),/append only/);
 assert.throws(()=>f.store.db.exec('DELETE FROM audit'),/append only/);
 assert.throws(()=>f.store.db.prepare('UPDATE invitations SET tenant_id=? WHERE id=?').run(f.outsider.tenantId,x.invite.id),/immutable/);
});
test('competing acceptance requests create exactly one account and one identity binding',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input(),x=send(f,auth,input);
 const gate=new SharedArrayBuffer(4),workers=[],ready=[],done=[];
 for(let i=0;i<4;i++){
  const worker=new Worker(new URL('./helpers/invitation-worker.mjs',import.meta.url),{workerData:{path:f.path,issuer:f.issuer,publicKey:f.publicKey,gate,token:x.token,identityToken:f.token(input.subject)}});workers.push(worker);
  ready.push(new Promise((resolve,reject)=>{worker.once('error',reject);worker.on('message',m=>{if(m==='ready')resolve();});}));
  done.push(new Promise((resolve,reject)=>{worker.once('error',reject);worker.on('message',m=>{if(m!=='ready')resolve(m);});}));
 }
 t.after(()=>Promise.all(workers.map(w=>w.terminate())));await Promise.all(ready);Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0);
 const results=await Promise.all(done);assert.equal(results.filter(r=>r.state==='ACTIVE').length,1);assert.equal(results.filter(r=>r.code==='INVITATION').length,3);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM users WHERE username=?').get(input.recipient).n,1);
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE resource_id=? AND action='invitation:active'").get(x.invite.id).n,1);
});

test('HTTP rejects CSRF, role injection and floods, and recovers from session-store outage',async t=>{
 const f=await invitationFixture(t),app=makeOperationsApp({store:f.store,operations:f.ops,identityVerifier:f.verifier,invitationTransport:f.transport});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
 const base='http://127.0.0.1:'+app.address().port,auth=f.auth(f.manager);
 const post=(path,body,headers={})=>fetch(base+'/api/ops/'+path,{method:'POST',headers:{origin:base,'content-type':'application/json',cookie:'iway_ops='+auth.token,...headers},body:JSON.stringify(body)});
 assert.equal((await post('invitations/create',f.input())).status,403);
 assert.equal((await post('invitations/create',{...f.input(),tenantId:f.outsider.tenantId},{'x-csrf-token':auth.csrf})).status,422);
 assert.equal((await post('invitations/create',f.input(),{origin:'https://untrusted.invalid','x-csrf-token':auth.csrf})).status,403);
 const original=f.store.db.prepare;f.store.db.prepare=()=>{throw Error('Synthetic unavailable database');};
 const outage=await post('identity-login',{identityToken:f.token('none')});assert.equal(outage.status,503);assert.equal((await outage.json()).code,'UNAVAILABLE');f.store.db.prepare=original;
 assert.equal((await post('invitations/create',f.input(),{'x-csrf-token':auth.csrf})).status,201);
 for(let i=0;i<12;i++)assert.equal((await post('invitations/open',{token:'invalid'})).status,401);
 assert.equal((await post('invitations/open',{token:'invalid'})).status,429);
});

test('configured administrative denies apply again when an invitation is accepted',async t=>{
 const f=await invitationFixture(t),auth=f.auth(f.manager),input=f.input(),x=send(f,auth,input);
 createOperationsAdmin(f.store);
 f.store.db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?,?)').run(f.manager.tenantId,'permission-set','restricted',1,JSON.stringify({denials:['user:manage']}));
 f.store.db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?,?)').run(f.manager.tenantId,'permission-assignment',f.manager.id,1,JSON.stringify({setIds:['restricted']}));
 denied(()=>f.service.accept(x.token,f.token(input.subject)),'FORBIDDEN');denied(()=>f.service.create(auth,f.input()),'FORBIDDEN');
});
