import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {uatFixture,syntheticRoster,syntheticPassword} from './helpers/uat-fixture.mjs';
import {validateUatRoster,createUatWorkflow} from '../server/operations-uat-workflow.mjs';
import {authorize} from '../domain/authorization.mjs';

test('approved real roster remains non-executable until independently provisioned and mapped',async()=>{
 const approved=JSON.parse(await readFile(new URL('../docs/security/uat-approved-roster.json',import.meta.url)));
 assert.equal(approved.testers.length,4);assert.throws(()=>validateUatRoster(approved.testers),/INCOMPLETE/);
 assert.equal(approved.testers[0].tenantId,null);
 assert.throws(()=>validateUatRoster(syntheticRoster.slice(1)),/FOUR/);
 assert.throws(()=>validateUatRoster(syntheticRoster.map((e,i)=>i===3?{...e,email:syntheticRoster[0].email}:e)),/UNIQUE/);
});
test('only a verified MFA administrator and explicit issuance approval can request setup',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());
 await assert.rejects(f.workflow.issue({adminSession:'attacker',userId:syntheticRoster[3].userId}),/DENIED/);assert.equal(f.mail.length,0);
 const workflow=createUatWorkflow({...f.dependencies,authorizeIssuance:async()=>false});
 await assert.rejects(workflow.issue({adminSession:'synthetic-approved-admin',userId:syntheticRoster[3].userId}),/DENIED/);assert.equal(f.mail.length,0);
});
test('setup invitation is encrypted, single-use and never creates a session or stores a password',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=await f.activate();
 assert.equal(f.rows.size,0);assert.equal(f.store.state(entry.userId).ready,1);
 const token=f.mail[0].token,stored=f.db.prepare('SELECT * FROM uat_invites').get();assert.notEqual(stored.hash,token);assert.equal(stored.proof,null);
 await assert.rejects(f.workflow.setup({token,password:syntheticPassword,network:'another-network'}),/DENIED/);
 const audit=f.db.prepare('SELECT * FROM uat_audit').all();assert.ok(audit.some(e=>e.event==='invitation.redeemed'));
 assert.ok(!JSON.stringify(audit).includes(token));assert.ok(!JSON.stringify(audit).includes(syntheticPassword));
});
test('expired, revoked and superseded invitations deny; retained evidence records expiry and revocation',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const userId=syntheticRoster[3].userId;
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId,ttlSeconds:60});const expired=f.mail.at(-1).token;f.advance(60001);
 await assert.rejects(f.workflow.setup({token:expired,password:syntheticPassword,network:'a'}));
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId});const superseded=f.mail.at(-1).token;
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId});
 await assert.rejects(f.workflow.setup({token:superseded,password:syntheticPassword,network:'b'}));
 await f.workflow.revoke({adminSession:'synthetic-approved-admin',userId});
 await assert.rejects(f.workflow.setup({token:f.mail.at(-1).token,password:syntheticPassword,network:'c'}));
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM uat_invites').get().n,3);
 assert.ok(f.db.prepare("SELECT 1 FROM uat_audit WHERE event='invitation.expired'").get());
});
test('simultaneous redemptions have exactly one winner',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:syntheticRoster[3].userId});
 const attempts=await Promise.allSettled(Array.from({length:6},(_,i)=>f.workflow.setup({token:f.mail[0].token,password:syntheticPassword,network:'parallel-'+i})));
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.rows.size,0);
});
test('password setup gates sign-in; unknown and invalid credentials deny without issuing a session',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=syntheticRoster[3];
 await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'a'}));assert.equal(f.providerCalls,0);
 await f.activate();await assert.rejects(f.workflow.passwordLogin({email:'fifth@illustrative.invalid',password:syntheticPassword,network:'b'}));assert.equal(f.providerCalls,0);
 await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:'invalid',network:'c'}));assert.equal(f.rows.size,0);
 const result=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'d'});assert.equal((await f.workflow.session(result.id)).userId,entry.userId);
});
test('Google and password map to the same UUID; matching email never replaces a pinned Google subject',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=await f.activate();
 const password=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'a'}),google=await f.workflow.googleSession(f.tokens(entry.userId));
 assert.equal((await f.workflow.session(password.id)).userId,(await f.workflow.session(google.id)).userId);
 await assert.rejects(f.workflow.googleSession(f.tokens(entry.userId,'aal1','other-google-subject')));
 const fifth=f.tokens('90000000-0000-4000-8000-000000000099');f.identities.get(fifth.accessToken).email=entry.email;
 await assert.rejects(f.workflow.googleSession(fifth));
});
test('platform and carrier require single-use MFA step-up; low assurance never receives an app session',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());
 for(const i of [0,1]){
  const entry=await f.activate(i);const pending=await f.workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'mfa-'+i});
  assert.equal(pending.mfaRequired,true);assert.equal(pending.id,undefined);
  const session=await f.workflow.completeMfa({pending:pending.pending,code:'123456',network:'mfa-step-'+i});assert.equal((await f.workflow.session(session.id)).role,entry.role);
  await assert.rejects(f.workflow.completeMfa({pending:pending.pending,code:'123456',network:'mfa-replay-'+i}));
 }
 const pending=await f.workflow.googleSession(f.tokens(syntheticRoster[0].userId));assert.equal(pending.mfaRequired,true);
 await assert.rejects(f.workflow.completeMfa({pending:pending.pending,code:'000000',network:'bad-code'}));
});
test('recovery invalidates old application sessions and concurrent revocation defeats in-flight password setup',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=await f.activate(),session=await f.workflow.googleSession(f.tokens(entry.userId));
 await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId,purpose:'recovery'});assert.equal(await f.workflow.session(session.id),null);
 let release;f.provider.setPassword=async()=>new Promise(r=>{release=r;});const workflow=createUatWorkflow(f.dependencies);
 const result=workflow.setup({token:f.mail.at(-1).token,password:syntheticPassword,network:'recovery'});
 while(!release)await new Promise(r=>setImmediate(r));f.store.revoke(entry.userId,{deactivate:true});release();await assert.rejects(result,/SETUP_REJECTED/);assert.equal(f.store.state(entry.userId).ready,0);
});
test('current permission/relationship checks reject drift and revoke stale sessions',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=syntheticRoster[3],session=await f.workflow.googleSession(f.tokens(entry.userId));
 f.memberships.get(entry.userId).fleetId='90000000-0000-4000-8000-000000000021';assert.equal(await f.workflow.session(session.id),null);
 const carrier=syntheticRoster[1],driver=syntheticRoster[3],fleet=syntheticRoster[2];
 for(const actor of [carrier,driver,fleet])assert.equal(authorize({actor,action:'load:view',resource:{tenantId:'90000000-0000-4000-8000-000000000011',fleetId:actor.fleetId,driverId:actor.principalId}}),false);
 assert.equal(authorize({actor:syntheticRoster[0],action:'load:view',resource:{tenantId:carrier.tenantId}}),false);
});
test('refresh preserves identity; logout and absolute expiry deny session reuse',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const result=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId));
 await f.workflow.refresh(result.id);assert.ok(await f.workflow.session(result.id));await f.workflow.logout(result.id);assert.equal(await f.workflow.session(result.id),null);
 const next=await f.workflow.googleSession(f.tokens(syntheticRoster[3].userId));f.advance(3600001);assert.equal(await f.workflow.session(next.id),null);
});
test('account and network limits apply before calling the provider',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=await f.activate();
 for(let i=0;i<8;i++)await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:'wrong',network:'ip-'+i}));
 assert.ok(f.providerCalls<=4);
 for(let i=0;i<12;i++)await assert.rejects(f.workflow.passwordLogin({email:'unknown@illustrative.invalid',password:'wrong',network:'same-ip'}));
 assert.equal(f.rows.size,0);
});
test('short rate windows cannot erase the longer account window',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const entry=await f.activate();
 for(let i=0;i<4;i++)await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:'wrong',network:'first-'+i}));
 const calls=f.providerCalls;f.advance(60001);
 await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:'wrong',network:'next-window'}));assert.equal(f.providerCalls,calls);
 f.advance(900001);await assert.rejects(f.workflow.passwordLogin({email:entry.email,password:'wrong',network:'expired-window'}));assert.equal(f.providerCalls,calls+1);
});
test('expiry maintenance erases encrypted secrets while retaining invitation and audit records',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());await f.workflow.issue({adminSession:'synthetic-approved-admin',userId:syntheticRoster[3].userId,ttlSeconds:60});
 f.advance(60001);assert.equal(await f.workflow.maintain(),1);
 const row=f.db.prepare('SELECT proof,consumed FROM uat_invites').get();assert.equal(row.proof,null);assert.ok(row.consumed);
 assert.ok(f.db.prepare("SELECT 1 FROM uat_audit WHERE event='invitation.expired'").get());
});
test('failed issuance cannot reactivate a previously deactivated identity',async t=>{
 const f=uatFixture();t.after(()=>f.db.close());const userId=syntheticRoster[3].userId;
 await f.workflow.revoke({adminSession:'synthetic-approved-admin',userId});
 await assert.rejects(f.workflow.issue({adminSession:'synthetic-approved-admin',userId}));
 assert.equal(f.store.state(userId).active,0);
});
