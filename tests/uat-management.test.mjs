import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {uatFixture,syntheticPassword} from './helpers/uat-fixture.mjs';
import {managementFixture} from './helpers/uat-management-fixture.mjs';
import {createUatManagementPlane,createConfidentialUatDelivery} from '../server/operations-uat-management.mjs';
import {resolveUatManagementDatabaseConfig} from '../server/operations-uat-management-postgres.mjs';
const request=(f,index=3)=>({adminSession:'synthetic-approved-admin',userId:f.dependencies.roster[index].userId,idempotencyKey:randomUUID()});

test('management defaults deny absent approval/providers, unapproved administrators and invalid bindings before privileged calls',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f);
 for(const patch of [{getApproval:undefined},{adminClient:undefined},{send:undefined}])await assert.rejects(createUatManagementPlane({...m.config,...patch}).issue(request(f)));
 await assert.rejects(m.plane.issue({...request(f),adminSession:'unapproved'}));
 await assert.rejects(m.plane.issue({...request(f),userId:randomUUID()}));
 await assert.rejects(m.plane.issue({...request(f),purpose:'revoke'}));
 assert.equal(m.generated,0);assert.equal(m.messages.length,0);assert.equal(m.commandStore.rows.size,0);
});
test('owner approval pins project, roster, origin, action, actor, start and expiration',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),saved=structuredClone(m.approval);
 for(const patch of [{projectId:'unapproved-project'},{rosterDigest:'a'.repeat(64)},{origin:'https://evil.invalid/path'},{operations:[]},{actorIds:[]},{notBefore:f.dependencies.clock()+1},{expiresAt:f.dependencies.clock()},{status:'revoked'}]){
  Object.assign(m.approval,saved,patch);await assert.rejects(m.plane.issue(request(f)));
 }
 assert.equal(m.generated,0);assert.equal(m.messages.length,0);
});
for(const index of [0,1,2,3])test(`management ${['platform','carrier','fleet','driver'][index]} activation, canonical mapping, MFA, recovery and revocation`,async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f,index),entry=f.dependencies.roster[index];
 const attempts=await Promise.allSettled(Array.from({length:8},()=>m.plane.issue(r)));assert.ok(attempts.some(x=>x.status==='fulfilled'));assert.equal(m.generated,1);assert.equal(m.messages.length,1);
 assert.deepEqual(await m.plane.issue(r),{ok:true,replayed:true,operation:'setup'});assert.equal(m.generated,1);
 const token=f.mail.at(-1).token;assert.ok(!JSON.stringify(attempts.filter(x=>x.status==='fulfilled')).includes(token));
 await f.workflow.setup({token,password:syntheticPassword,network:'management-setup'});await assert.rejects(f.workflow.setup({token,password:syntheticPassword,network:'management-replay'}));
 const initial=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'management-login'});
 const password=initial.mfaRequired?await f.workflow.completeMfa({pending:initial.pending,code:'123456',network:'management-mfa'}):initial;
 if(['platform','carrier'].includes(entry.role))assert.equal(initial.mfaRequired,true);
 const google=await f.workflow.googleSession(f.tokens(entry.userId,['platform','carrier'].includes(entry.role)?'aal2':'aal1'));
 assert.equal((await f.workflow.session(password.id)).principalId,(await f.workflow.session(google.id)).principalId);
 await m.plane.issue({...r,idempotencyKey:randomUUID(),purpose:'recovery'});assert.equal(await f.workflow.session(password.id),null);assert.equal(await f.workflow.session(google.id),null);
 await f.workflow.setup({token:f.mail.at(-1).token,password:syntheticPassword,network:'management-recovery'});
 await m.plane.revoke({...r,idempotencyKey:randomUUID()});await assert.rejects(f.workflow.googleSession(f.tokens(entry.userId,'aal2')));
});
test('verified provider UUID, confirmed email and exact Google subject are required; email-only linking is refused',async t=>{
 for(const mutate of [u=>{u.id=randomUUID();},u=>{u.email_confirmed_at=null;},u=>{u.identities=[];},u=>{u.identities[0].identity_data.sub='other';}]){
  const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f);mutate(m.users.get(request(f).userId));await assert.rejects(m.plane.issue(request(f)));assert.equal(m.generated,0);assert.equal(m.messages.length,0);
 }
});
test('permission, tenant, fleet and principal drift fail before issuance',async t=>{
 for(const patch of [{permissions:['platform:invite']},{tenantId:randomUUID()},{fleetId:randomUUID()},{principalId:randomUUID()},{active:false},{tenantActive:false}]){
  const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f);Object.assign(f.memberships.get(r.userId),patch);await assert.rejects(m.plane.issue(r));assert.equal(m.generated,0);assert.equal(m.messages.length,0);
 }
});
test('conflicting retries and concurrent different keys cannot replace in-flight delivery',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f);let release;
 const plane=createUatManagementPlane({...m.config,send:async()=>new Promise(resolve=>{release=()=>resolve({accepted:true});})});
 const first=plane.issue(r);while(!release)await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(plane.issue({...r,purpose:'recovery'}));await assert.rejects(plane.issue({...r,idempotencyKey:randomUUID()}));release();await first;assert.equal(m.generated,1);
});
test('failed or ambiguous delivery erases proof, invalidates sessions and fences all retries without leaking provider errors',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f);
 const session=await f.workflow.googleSession(f.tokens(r.userId));
 const plane=createUatManagementPlane({...m.config,send:async()=>{throw Error('synthetic-private-provider-error');}});
 await assert.rejects(plane.issue(r),e=>e.message==='UAT_MANAGEMENT_REJECTED');
 await assert.rejects(plane.issue(r));await assert.rejects(plane.issue({...r,idempotencyKey:randomUUID()}));assert.equal(m.generated,1);assert.equal(await f.workflow.session(session.id),null);
 assert.equal(f.db.prepare('SELECT proof FROM uat_invites').get().proof,null);assert.equal([...m.commandStore.rows.values()][0].status,'uncertain');
});
test('approval revoked during provider work prevents delivery and fences invitation proof',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),generate=m.config.adminClient.auth.admin.generateLink;
 m.config.adminClient.auth.admin.generateLink=async input=>{const result=await generate(input);m.approval.status='revoked';return result;};
 await assert.rejects(m.plane.issue(request(f)));assert.equal(m.messages.length,0);assert.equal([...m.commandStore.rows.values()][0].status,'uncertain');
});
test('confidential adapter rejects absent authorization, transport, invalid origin and response; never returns the link',async()=>{
 const entry={email:'synthetic@illustrative.invalid'},token='a'.repeat(43),requestId=randomUUID();let sent;
 for(const config of [{origin:'https://uat.illustrative.invalid'},{origin:'https://uat.illustrative.invalid',send:async()=>({accepted:true})},{origin:'https://evil.invalid/?redirect=x',send:async()=>({accepted:true}),authorizeDelivery:async()=>true}])await assert.rejects(createConfidentialUatDelivery(config)({entry,token,requestId,purpose:'setup'}));
 const deliver=createConfidentialUatDelivery({origin:'https://uat.illustrative.invalid',send:async value=>{sent=value;return {accepted:true};},authorizeDelivery:async()=>true});
 assert.deepEqual(await deliver({entry,token,requestId,purpose:'setup'}),{ok:true});const link=new URL(sent.text.split(' ').at(-1));assert.equal(link.pathname,'/uat/setup');assert.equal(link.search,'');assert.equal(link.hash,'#'+token);
});
test('ambiguous completion after delivery fences broker proof and cannot resend',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f);m.commandStore.complete=async()=>false;
 const plane=createUatManagementPlane(m.config),r=request(f);await assert.rejects(plane.issue(r));await assert.rejects(plane.issue(r));
 assert.equal(m.messages.length,1);assert.equal(f.db.prepare('SELECT proof FROM uat_invites').get().proof,null);assert.equal([...m.commandStore.rows.values()][0].status,'uncertain');
});
test('confidential transport timeout aborts the request and redacts its outcome',async()=>{
 let signal;const deliver=createConfidentialUatDelivery({origin:'https://uat.illustrative.invalid',timeoutMs:5,authorizeDelivery:async()=>true,send:async input=>{signal=input.signal;return new Promise(()=>{});}});
 await assert.rejects(deliver({entry:{email:'synthetic@illustrative.invalid'},token:'a'.repeat(43),requestId:randomUUID(),purpose:'setup'}),/CONFIDENTIAL_DELIVERY_UNAVAILABLE/);assert.equal(signal.aborted,true);
});
test('separate management database config pins restricted identity/project and verified TLS',()=>{
 const url='postgresql://iway_uat_management_runtime:synthetic-test-password@db.zolwjyhbfsxbdwyiwkbt.supabase.co:5432/postgres';
 const config=resolveUatManagementDatabaseConfig(url);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.user,'iway_uat_management_runtime');
 for(const bad of [url.replace('iway_uat_management_runtime','postgres'),url.replace('zolwjyhbfsxbdwyiwkbt','anotherproject0000000'),url+'?sslmode=disable',url.replace(':5432',':6543')])assert.throws(()=>resolveUatManagementDatabaseConfig(bad));
});
test('broker revocation is checked before privileged provider generation',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f);f.store.revoke(r.userId,{deactivate:true});
 await assert.rejects(m.plane.issue(r));assert.equal(m.generated,0);assert.equal(m.commandStore.rows.size,0);
});
test('relationship revoked while provider work is in flight prevents delivery',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const m=managementFixture(f),r=request(f),generate=m.config.adminClient.auth.admin.generateLink;
 m.config.adminClient.auth.admin.generateLink=async input=>{const result=await generate(input);f.memberships.get(r.userId).tenantActive=false;return result;};
 await assert.rejects(m.plane.issue(r));assert.equal(m.generated,1);assert.equal(m.messages.length,0);assert.equal([...m.commandStore.rows.values()][0].status,'uncertain');
});
