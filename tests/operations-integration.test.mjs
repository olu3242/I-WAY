import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fixture} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createDocumentExtensions} from '../domain/operations-documents.mjs';
import {createIntegrationExtensions,integrationState,integrationIntegritySQL,signFixtureEnvelope,claimIntegration,completeIntegration,runIntegrationTick,localSignedMessageAdapter} from '../domain/operations-integration.mjs';
const run=promisify(execFile),code=value=>error=>error.code===value;
const provider=f=>({id:'illustrative-partner',tenantId:f.manager.tenantId,mode:'local-fixture',keys:{fixture_v1:Buffer.alloc(32,7)}});
function install(f,p=provider(f)){f.providers=[p];Object.assign(f.ops.extensions,createIntegrationExtensions({providers:f.providers}),createDocumentExtensions());f.ops.views.push(integrationState);f.store.db.exec(integrationIntegritySQL);return f;}
const event=(f,externalId='fixture-event-1',type='shipment',data={status:'delayed'})=>({schemaVersion:1,externalId,type,occurredAt:f.ops.now().toISOString(),data});
const envelope=(f,e)=>signFixtureEnvelope(f.providers[0],e,{timestamp:f.ops.now().getTime()});
const queue=(f,load,e=event(f))=>f.command(f.dispatcher,'integration:queue',load,{providerId:f.providers[0].id,event:e});
function revoke(f,actor,permission){const user=f.store.principal(actor.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...user,permissions:user.permissions.filter(value=>value!==permission)}),actor.id);}
test('B54 signed inbox verifies local tenant binding, redacts signatures and deduplicates without operational writes',async t=>{
 const f=install(await fixture(t)),load=f.assign(),e=event(f),signed=envelope(f,e);
 const receipt=f.command(f.dispatcher,'integration:ingest',load,{envelope:signed});
 assert.equal(receipt.signatureVerified,true);assert.equal(receipt.event.applied,false);assert.equal(receipt.live,false);
 assert.equal(f.command(f.dispatcher,'integration:ingest',load,{envelope:signed}).id,receipt.id);
 assert.equal(f.store.list('integrationreceipt',load.tenantId).length,1);assert.deepEqual(f.store.get('load',load.id,load.tenantId),load);
 const persisted=JSON.stringify(f.store.db.prepare('SELECT data FROM resources WHERE kind LIKE ?').all('integration%'))+JSON.stringify(f.store.db.prepare('SELECT detail FROM audit').all())+JSON.stringify(f.store.db.prepare('SELECT result FROM commands').all());
 assert.ok(!persisted.includes(signed.signature));assert.ok(!persisted.includes('fixture_v1":'));
 assert.throws(()=>f.store.update('integrationreceipt',receipt.id,load.tenantId,receipt.version,{signatureVerified:false}),/immutable/);
 const reopened=new OperationsStore(f.path);assert.equal(reopened.list('integrationreceipt',load.tenantId)[0].eventHash,receipt.eventHash);reopened.close();
});
test('B54 rejects tampering, expired signatures, unknown providers, cross-tenant binding and altered replay',async t=>{
 const f=install(await fixture(t)),load=f.assign(),signed=envelope(f,event(f));
 for(const patch of [{signature:'0'.repeat(64)},{body:signed.body.replace('delayed','delivered')},{timestamp:signed.timestamp-300001},{providerId:'unregistered'}]){
  assert.throws(()=>f.command(f.dispatcher,'integration:ingest',load,{envelope:{...signed,...patch}}));
 }
 assert.throws(()=>f.command(f.outsider,'integration:ingest',load,{envelope:signed}),code('NOT_FOUND'));
 assert.throws(()=>f.command(f.otherDispatcher,'integration:ingest',load,{envelope:signed}),code('FORBIDDEN'));
 const wrongTenant={...f.providers[0],tenantId:f.outsider.tenantId};Object.assign(f.ops.extensions,createIntegrationExtensions({providers:[wrongTenant]}));
 assert.throws(()=>f.command(f.dispatcher,'integration:ingest',load,{envelope:signed}),code('INTEGRATION_PROVIDER'));
 Object.assign(f.ops.extensions,createIntegrationExtensions({providers:f.providers}));
 f.command(f.dispatcher,'integration:ingest',load,{envelope:signed});
 assert.throws(()=>f.command(f.dispatcher,'integration:ingest',load,{envelope:envelope(f,event(f,'fixture-event-1','shipment',{status:'delivered'}))}),code('INTEGRATION_REPLAY'));
});
test('B54 durable local outbox completes once, rejects stale completion and never reports external delivery',async t=>{
 const f=install(await fixture(t)),load=f.assign(),original=event(f),job=queue(f,load,original);
 assert.equal(queue(f,load,original).id,job.id);
 assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),1);
 assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),0);
 const done=f.store.get('integrationjob',job.id,load.tenantId);
 assert.equal(done.status,'completed');assert.equal(done.externalDelivery,false);assert.equal(done.attempts,1);
 assert.equal(completeIntegration(f.ops,{tenantId:load.tenantId,jobId:job.id,workerId:'wrong',fence:1},{status:'local_recorded',externalDelivery:false},{providers:f.providers}).accepted,false);
 assert.deepEqual(f.store.get('load',load.id,load.tenantId),load);
});
test('B54 retry backoff reaches dead letter and circuit cooldown admits only one recovery probe',async t=>{
 let now=new Date('2026-10-11T12:00:00.000Z');const f=await fixture(t,{now:()=>now}),p=provider(f);p.adapter={...localSignedMessageAdapter,deliver:async()=>{throw new Error('untrusted-private-adapter-detail')}};
 install(f,p);const load=f.assign(),job=queue(f,load);
 for(let attempt=1;attempt<=3;attempt++){assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),0);const current=f.store.get('integrationjob',job.id,load.tenantId);assert.equal(current.attempts,attempt);if(attempt<3){assert.equal(current.status,'retry');assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),0);now=new Date(now.getTime()+9000);}}
 assert.equal(f.store.get('integrationjob',job.id,load.tenantId).status,'dead_letter');
 const next=queue(f,load,event(f,'next-event')),third=queue(f,load,event(f,'third-event'));
 assert.equal(claimIntegration(f.ops,{tenantId:load.tenantId,jobId:next.id,workerId:'early-worker',providers:f.providers}),null);
 now=new Date(now.getTime()+31000);
 const claim=claimIntegration(f.ops,{tenantId:load.tenantId,jobId:next.id,workerId:'recovery-worker',providers:f.providers});
 assert.ok(claim);assert.equal(claimIntegration(f.ops,{tenantId:load.tenantId,jobId:third.id,workerId:'other-worker',providers:f.providers}),null);
 p.adapter={...localSignedMessageAdapter};
 assert.equal(completeIntegration(f.ops,claim,{status:'local_recorded',externalDelivery:false},{providers:f.providers}).accepted,true);
 assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),1);
 const dead=f.store.get('integrationjob',job.id,load.tenantId),retry=f.command(f.dispatcher,'integration:retry',dead,{reason:'Provider fixture recovered'});
 assert.equal(retry.attempts,0);assert.equal(await runIntegrationTick(f.ops,{providers:f.providers}),1);
 assert.ok(!JSON.stringify(f.store.db.prepare('SELECT detail FROM audit').all()).includes('untrusted-private-adapter-detail'));
});
test('B54 local adapter timeout and fabricated external success fail closed',async t=>{
 const f=await fixture(t),p=provider(f);p.adapter={...localSignedMessageAdapter,deliver:()=>new Promise(()=>{})};install(f,p);
 const load=f.assign(),job=queue(f,load);
 assert.equal(await runIntegrationTick(f.ops,{providers:f.providers,timeoutMs:5}),0);assert.equal(f.store.get('integrationjob',job.id,load.tenantId).lastError,'INTEGRATION_TIMEOUT');
 const other=queue(f,load,event(f,'forged-success'));p.adapter={...localSignedMessageAdapter,deliver:async()=>({status:'delivered',externalDelivery:true})};
 await runIntegrationTick(f.ops,{providers:f.providers});assert.equal(f.store.get('integrationjob',other.id,load.tenantId).status,'blocked');
});
test('B54 authority changes while provider runs and stale leases cannot commit results',async t=>{
 let now=new Date('2026-10-11T12:00:00.000Z');const f=install(await fixture(t,{now:()=>now})),load=f.assign(),job=queue(f,load);
 const claim=claimIntegration(f.ops,{tenantId:load.tenantId,jobId:job.id,workerId:'old-worker',providers:f.providers,leaseMs:100});
 now=new Date(now.getTime()+101);
 const newer=claimIntegration(f.ops,{tenantId:load.tenantId,jobId:job.id,workerId:'new-worker',providers:f.providers});
 assert.ok(newer);assert.equal(completeIntegration(f.ops,claim,{status:'local_recorded',externalDelivery:false},{providers:f.providers}).reason,'LEASE_STALE');
 revoke(f,f.dispatcher,'connector:request');
 assert.equal(completeIntegration(f.ops,newer,{status:'local_recorded',externalDelivery:false},{providers:f.providers}).reason,'AUTHORITY_CHANGED');
 assert.equal(f.store.get('integrationjob',job.id,load.tenantId).status,'blocked');
 assert.equal(integrationState(f.ops,f.dispatcher,[load]).integrationJobs.length,0);
});
test('B54 current document grants protect queued evidence and inbox replay',async t=>{
 const f=install(await fixture(t)),load=f.assign(),doc=f.command(f.dispatcher,'document:ingest',load,{type:'other',mimeType:'text/plain',content:'Illustrative local reference'});
 const e=event(f,'doc-event','document',{documentId:doc.id,contentHash:doc.contentHash,status:'received'}),job=queue(f,load,e),signed=envelope(f,e);
 f.command(f.dispatcher,'integration:ingest',load,{envelope:signed},'doc-inbox-replay');
 revoke(f,f.dispatcher,'document:view');
 assert.equal(claimIntegration(f.ops,{tenantId:load.tenantId,jobId:job.id,workerId:'doc-worker',providers:f.providers}),null);
 assert.equal(f.store.get('integrationjob',job.id,load.tenantId).status,'blocked');
 assert.equal(integrationState(f.ops,f.dispatcher,[load]).integrationReceipts.length,0);
 assert.throws(()=>f.command(f.dispatcher,'integration:ingest',load,{envelope:signed},'doc-inbox-replay'),code('FORBIDDEN'));
});
test('B54 competing processes claim one durable message, with current tenant authority and fencing',async t=>{
 const f=install(await fixture(t)),load=f.assign(),job=queue(f,load);
 const script=`import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {claimIntegration} from './domain/operations-integration.mjs';const [path,tenantId,jobId,workerId]=process.argv.slice(1);const store=new OperationsStore(path),ops=new Operations(store);const claim=claimIntegration(ops,{tenantId,jobId,workerId,providers:[{id:'illustrative-partner',tenantId,mode:'local-fixture',keys:{fixture_v1:Buffer.alloc(32,7)}}]});process.stdout.write(JSON.stringify(!!claim));store.close();`;
 const results=await Promise.all(['process-a','process-b'].map(worker=>run(process.execPath,['--input-type=module','-e',script,f.path,load.tenantId,job.id,worker],{cwd:process.cwd()})));
 assert.equal(results.map(result=>JSON.parse(result.stdout)).filter(Boolean).length,1);
 const current=f.store.get('integrationjob',job.id,load.tenantId);assert.equal(current.attempts,1);assert.equal(current.fence,1);
 assert.throws(()=>f.store.update('integrationjob',job.id,load.tenantId,current.version,{event:null}),/immutable/);
 assert.throws(()=>f.store.db.prepare('DELETE FROM resources WHERE id=?').run(job.id),/cannot be deleted/);
});

 test('carrier governance revocation fences queued and running integration work; timeout aborts fixture adapter',async t=>{
  const {createRuntimeExtensions}=await import('../domain/operations-runtime.mjs');
  const f=install(await fixture(t));Object.assign(f.ops.extensions,createRuntimeExtensions());const load=f.assign(),job=queue(f,load);
  const claim=claimIntegration(f.ops,{tenantId:load.tenantId,jobId:job.id,workerId:'fixture-worker',providers:f.providers});assert.ok(claim);
  let policy=f.command(f.manager,'governance:update',null,{enabled:false,disabledTools:[],reason:'Human disables integration'});
  assert.equal(completeIntegration(f.ops,claim,{status:'local_recorded',externalDelivery:false},{providers:f.providers}).reason,'POLICY_BLOCKED');
  assert.throws(()=>queue(f,load,event(f,'blocked-event')),code('POLICY_BLOCKED'));
  policy=f.command(f.manager,'governance:update',policy,{enabled:true,disabledTools:[],reason:'Human permits local test'});
  let signal;f.providers[0].adapter={...localSignedMessageAdapter,deliver:async r=>{signal=r.signal;return new Promise(()=>{})}};
  const next=queue(f,load,event(f,'timeout-event'));await runIntegrationTick(f.ops,{providers:f.providers,timeoutMs:5});
  assert.equal(signal.aborted,true);assert.equal(f.store.get('integrationjob',next.id,load.tenantId).status,'retry');
 });
