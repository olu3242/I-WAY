import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {invitationFixture} from './helpers/invitation-fixture.mjs';
import {authenticateIdentity} from '../server/operations-identity.mjs';
import {uatFeedback} from '../server/operations-feedback.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';
const payload={workflow:'loads',symptom:'cannot_complete',severity:'major',reproducibility:'always'};
test('feedback remains disabled without opt-in and does not require native users to enroll MFA',async t=>{
 const f=await invitationFixture(t),result=uatFeedback(f.store,f.auth(f.manager),{action:'list'},f.now());
 assert.equal(result.enabled,false);assert.deepEqual(result.rows,[]);assert.deepEqual(result.events,[]);assert.deepEqual(result.owners,[]);
 assert.throws(()=>uatFeedback(f.store,f.auth(f.manager),{action:'create',payload,idempotencyKey:randomUUID()},f.now()),e=>e.status===403);
});
async function fixture(t){
 const f=await invitationFixture(t);
 for(const actor of [f.platform,f.manager,f.fleetUser,f.driver,f.outsider]){
  actor.uatFeedbackAccess=['submit',...(['platform','carrier','fleet'].includes(actor.role)?['triage']:[])];
  f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(actor),actor.id);
  f.store.db.prepare('INSERT INTO identity_bindings VALUES(?,?,?,?,1)').run(f.issuer,createHash('sha256').update(actor.id).digest('hex'),actor.id,actor.tenantId);
 }
 const auth=(actor,changes)=>authenticateIdentity(f.store,f.verifier,f.token(actor.id,changes),f.now());
 const command=(action,p={},row=null,key=randomUUID())=>({action,payload:p,...(row?{id:row.id,expectedVersion:row.version}:{}),idempotencyKey:key});
 const run=(actor,input)=>uatFeedback(f.store,auth(actor),input,f.now());
 return {...f,auth,command,run};
}
test('feedback lifecycle requires authorized owner, reporter retest, safe metadata and durable audit',async t=>{
 const f=await fixture(t),{command,run,driver,manager}=f;const key=randomUUID();
 let row=run(driver,command('create',payload,null,key));assert.equal(run(driver,command('create',payload,null,key)).id,row.id);
 assert.equal(row.persona,'driver');assert.equal(row.reporterId,driver.id);
 for(const status of ['triaged','in_progress','awaiting_retest'])row=run(manager,command('triage',{status,ownerId:manager.id,reason:'investigating',...(status==='awaiting_retest'?{evidenceReference:'run-reviewed_0123'}:{})},row));
 row=run(driver,command('retest',{passed:false,evidenceReference:'run-retest_failed'},row));assert.equal(row.status,'in_progress');
 row=run(manager,command('triage',{status:'awaiting_retest',ownerId:manager.id,reason:'fix_available',evidenceReference:'a'.repeat(40)},row));
 row=run(driver,command('retest',{passed:true,evidenceReference:'run-retest_passed'},row));assert.equal(row.status,'closed');
 assert.throws(()=>run(manager,command('triage',{status:'triaged',ownerId:manager.id,reason:'investigating'},row)),e=>e.code==='TRANSITION');
 const state=run(driver,command('list'));assert.equal(state.rows.length,1);assert.equal(state.events.length,7);
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action LIKE 'feedback:%'").get().n,7);
});
test('feedback rejects raw diagnostics, unknown fields, URLs and invalid workflow metadata',async t=>{
 const f=await fixture(t);
 for(const bad of [{...payload,diagnostics:'Not accepted'},{...payload,tenantId:f.outsider.tenantId},{...payload,severity:'urgent'},{...payload,workflow:'https://unapproved.invalid'}])assert.throws(()=>f.run(f.driver,f.command('create',bad)));
 let row=f.run(f.driver,f.command('create',payload));
 for(const status of ['triaged','in_progress'])row=f.run(f.manager,f.command('triage',{status,ownerId:f.manager.id,reason:'investigating'},row));
 assert.throws(()=>f.run(f.manager,f.command('triage',{status:'awaiting_retest',ownerId:f.manager.id,reason:'fix_available',evidenceReference:'https://unapproved.invalid'},row)),e=>e.code==='EVIDENCE');
 assert.equal(f.store.list('uatfeedback',f.driver.tenantId).length,1);
});
test('feedback enforces tenant, fleet and reporter boundaries including replay after scope revocation',async t=>{
 const f=await fixture(t),row=f.run(f.driver,f.command('create',payload));
 assert.equal(f.run(f.outsider,f.command('list')).rows.length,0);assert.equal(f.run(f.fleetUser,f.command('list')).rows.length,0);
 assert.throws(()=>f.run(f.outsider,f.command('triage',{status:'triaged',ownerId:f.outsider.id,reason:'investigating'},row)));
 assert.throws(()=>f.run(f.fleetUser,f.command('triage',{status:'triaged',ownerId:f.fleetUser.id,reason:'investigating'},row)),e=>e.status===403);
 assert.throws(()=>f.run(f.driver,f.command('triage',{status:'triaged',ownerId:f.manager.id,reason:'investigating'},row)),e=>e.status===403);
 const key=randomUUID(),input=f.command('triage',{status:'triaged',ownerId:f.manager.id,reason:'investigating'},row,key);f.run(f.manager,input);
 const manager={...f.manager,uatFeedbackAccess:['submit']};f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(manager),manager.id);
 assert.throws(()=>f.run(manager,input),e=>e.status===403);
});
test('feedback denies forged, revoked and privileged AAL1 sessions; no grants are implied',async t=>{
 const f=await fixture(t),auth=f.auth(f.driver);
 assert.throws(()=>uatFeedback(f.store,{...auth},f.command('create',payload),f.now()),e=>e.status===401);
 assert.throws(()=>uatFeedback(f.store,f.auth(f.manager,{aal:'aal1'}),f.command('create',payload),f.now()),e=>e.code==='MFA_REQUIRED');
 f.store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(f.driver.id);
 assert.throws(()=>uatFeedback(f.store,auth,f.command('list'),f.now()),e=>e.status===401);
 const driver={...f.driver,uatFeedbackAccess:[]};f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(driver),driver.id);
 assert.equal(f.run(driver,f.command('list')).enabled,false);assert.throws(()=>f.run(driver,f.command('create',payload)),e=>e.status===403);
});
test('stale reviews, changed idempotency payloads, non-reporter acceptance and flooding fail safely',async t=>{
 const f=await fixture(t),key=randomUUID(),row=f.run(f.driver,f.command('create',payload,null,key));
 assert.throws(()=>f.run(f.driver,f.command('create',{...payload,severity:'minor'},null,key)),e=>e.code==='IDEMPOTENCY');
 const updated=f.run(f.manager,f.command('triage',{status:'triaged',ownerId:f.manager.id,reason:'investigating'},row));
 assert.throws(()=>f.run(f.manager,f.command('triage',{status:'triaged',ownerId:f.manager.id,reason:'investigating'},row)),e=>e.code==='STALE');
 assert.throws(()=>f.run(f.manager,f.command('retest',{passed:true,evidenceReference:'run-foreign_retest'},updated)),e=>e.status===403);
 for(let i=1;i<10;i++)f.run(f.driver,f.command('create',payload));
 assert.throws(()=>f.run(f.driver,f.command('create',payload)),e=>e.status===429);f.advance(600001);assert.equal(f.run(f.driver,f.command('create',payload)).status,'reported');
});
test('failed feedback audit rolls back record, event and idempotency receipt atomically',async t=>{
 const f=await fixture(t),audit=f.store.audit;
 f.store.audit=()=>{throw Error('ILLUSTRATIVE_STORAGE_FAILURE');};assert.throws(()=>f.run(f.driver,f.command('create',payload)));f.store.audit=audit;
 assert.equal(f.store.list('uatfeedback',f.driver.tenantId).length,0);assert.equal(f.store.list('uatfeedbackevent',f.driver.tenantId).length,0);
});
test('feedback HTTP requires identity, CSRF and same origin and never exposes another tenant feedback',async t=>{
 const f=await fixture(t),app=makeOperationsApp({store:f.store,operations:f.ops,identityVerifier:f.verifier});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>{app.closeAllConnections();return new Promise(r=>app.close(r));});
 const origin='http://127.0.0.1:'+app.address().port,url=origin+'/api/ops/feedback';
 assert.equal((await fetch(url,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'})).status,401);
 const auth=f.auth(f.driver),headers={origin,'content-type':'application/json',cookie:'iway_ops='+auth.token,'x-csrf-token':auth.csrf},body=JSON.stringify(f.command('create',payload));
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,origin:'https://foreign.invalid'},body})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,'x-csrf-token':'invalid'},body})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers,body})).status,200);
 const outsider=f.auth(f.outsider),response=await fetch(url,{method:'POST',headers:{...headers,cookie:'iway_ops='+outsider.token,'x-csrf-token':outsider.csrf},body:JSON.stringify(f.command('list'))});assert.equal(response.status,200);assert.equal((await response.json()).rows.length,0);
});
