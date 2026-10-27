import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers/operations-fixture.mjs';
import {offlineContext,executeOfflineCommand} from '../server/operations-offline.mjs';
import {createDriverQueue} from '../apps/operations/driver-offline.mjs';
const memory=()=>{const rows=new Map();return {list:async()=>structuredClone([...rows.values()]),put:async row=>rows.set(row.envelope.idempotencyKey,structuredClone(row)),remove:async key=>rows.delete(key),clear:async()=>rows.clear()};};
const envelope=(f,load,action='load:accept',payload={})=>({schemaVersion:1,...offlineContext(f.store.principal(f.driver.id)),action,resourceId:load.id,expectedVersion:load.version,idempotencyKey:randomUUID(),createdAt:Date.now(),payload});

test('offline acceptance/pickup/transit produce verified idempotent receipts and one transition each',async t=>{
 const f=await fixture(t);let load=f.assign();
 for(const [action,payload] of [['load:accept',{}],['load:pickup',{stopId:load.stops[0].id}],['load:transit',{}]]){
  const entry=envelope(f,load,action,payload),first=executeOfflineCommand(f.ops,f.driver,entry),second=executeOfflineCommand(f.ops,f.driver,entry);
  assert.equal(first.confirmed,true);assert.equal(first.idempotencyKey,entry.idempotencyKey);assert.deepEqual(second,first);load=first.result;
  assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action=? AND outcome='success'").get(action).n,1);
 }
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).status,'in_transit');
});
test('offline receipts recheck current driver, tenant, authority and reassignment before replay',async t=>{
 const f=await fixture(t),load=f.assign(),entry=envelope(f,load);executeOfflineCommand(f.ops,f.driver,entry);
 assert.throws(()=>executeOfflineCommand(f.ops,f.outsider,entry),e=>e.status===403);
 for(const patch of [{actorId:f.outsider.id},{tenantId:f.outsider.tenantId},{authorityFingerprint:'0'.repeat(64)},{createdAt:0},{action:'load:deliver',payload:{proofReference:'not allowed'}}])assert.throws(()=>executeOfflineCommand(f.ops,f.driver,{...entry,...patch}),e=>e.status===409);
 const current=f.store.get('load',load.id,f.manager.tenantId);f.store.update('load',current.id,current.tenantId,current.version,{driverId:f.otherDispatcher.id});
 assert.throws(()=>executeOfflineCommand(f.ops,f.driver,entry),e=>e.status===403);
});
test('offline stale version and revoked eligibility cannot mutate a shipment',async t=>{
 const f=await fixture(t),load=f.assign(),entry=envelope(f,load);
 assert.throws(()=>executeOfflineCommand(f.ops,f.driver,{...entry,expectedVersion:1}),e=>e.status===409);
 const driver=f.store.get('driver',f.driver.id,f.driver.tenantId);f.store.update('driver',driver.id,driver.tenantId,driver.version,{approved:false});
 assert.throws(()=>executeOfflineCommand(f.ops,f.driver,entry),e=>e.status===409);assert.equal(f.store.get('load',load.id,f.driver.tenantId).status,'assigned');
});
test('durable queue preserves keys across controller reload and ambiguous server completion',async()=>{
 const storage=memory(),context={tenantId:'tenant_1',actorId:'driver_1',authorityFingerprint:'a'.repeat(64)},command={action:'load:accept',resourceId:'load_1',expectedVersion:1,idempotencyKey:randomUUID(),payload:{}},sent=[];
 const dependencies={storage,readSession:async()=>({context,csrf:'RAM-only-test-value'}),clock:()=>1000,send:async entry=>{sent.push(entry.idempotencyKey);throw Error('response lost');}};
 await createDriverQueue(dependencies).enqueue(context,command);await createDriverQueue(dependencies).replay();assert.equal((await storage.list())[0].status,'needs_attention');
 const result=await createDriverQueue({...dependencies,send:async entry=>{sent.push(entry.idempotencyKey);return {confirmed:true,idempotencyKey:entry.idempotencyKey,result:{status:'accepted'}};}}).replay();
 assert.equal(result.status,'confirmed_by_server');assert.deepEqual(sent,[command.idempotencyKey,command.idempotencyKey]);assert.equal((await storage.list()).length,0);
});
test('queue pauses for reauthentication, purges changed identity and never stores credentials',async()=>{
 const storage=memory(),context={tenantId:'tenant_1',actorId:'driver_1',authorityFingerprint:'a'.repeat(64)},command={action:'load:accept',resourceId:'load_1',expectedVersion:1,idempotencyKey:randomUUID(),payload:{}};let sent=0;
 const queue=createDriverQueue({storage,readSession:async()=>{throw Error('expired');},send:async()=>sent++,clock:()=>1000});await queue.enqueue(context,command);await queue.replay();assert.equal(sent,0);assert.equal((await storage.list()).length,1);
 const different=createDriverQueue({storage,readSession:async()=>({context:{...context,actorId:'driver_2'},csrf:'RAM-only'}),send:async()=>sent++,clock:()=>1000});assert.equal((await different.replay()).status,'needs_attention');assert.equal((await storage.list()).length,0);assert.equal(sent,0);
 await queue.enqueue(context,command);assert.deepEqual(Object.keys((await storage.list())[0]).sort(),['envelope','status']);assert.equal(JSON.stringify(await storage.list()).includes('csrf'),false);await queue.clear();assert.equal((await storage.list()).length,0);
});
test('queue bounds, duplicate resource and private payload rejection fail without side effects',async()=>{
 const storage=memory(),context={tenantId:'tenant',actorId:'driver',authorityFingerprint:'a'.repeat(64)},queue=createDriverQueue({storage,clock:()=>1000}),command={action:'load:accept',resourceId:'load_1',expectedVersion:1,idempotencyKey:randomUUID(),payload:{}};
 await queue.enqueue(context,command);await assert.rejects(queue.enqueue(context,{...command,idempotencyKey:randomUUID()}),/ALREADY/);
 await assert.rejects(queue.enqueue(context,{...command,payload:{document:'denied'}}),/PAYLOAD/);
 for(let i=2;i<=20;i++)await queue.enqueue(context,{...command,resourceId:'load_'+i,idempotencyKey:randomUUID()});await assert.rejects(queue.enqueue(context,{...command,resourceId:'load_21',idempotencyKey:randomUUID()}),/LIMIT/);
});
