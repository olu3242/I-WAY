import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fixture} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createRuntimeExtensions,claimJob,heartbeatJob,executeAdvisory,completeJob,runRuntimeTick,runtimeLeasePolicy} from '../domain/operations-runtime.mjs';
import {localConnectorAdapters} from '../domain/operations-connectors.mjs';
const setup=(t,options={})=>fixture(t,{extensions:createRuntimeExtensions(),...options});
const request=f=>f.command(f.manager,'orchestration:request',f.createLoad());
const claim=(f,job,extra={})=>claimJob(f.ops,{tenantId:f.manager.tenantId,kind:'orchestration',jobId:job.id,workerId:'worker-a',leaseMs:1000,...extra});
const fresh=(f,job)=>f.store.get(job.kind,job.id,f.manager.tenantId);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function child(code,args){
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,['--input-type=module','-e',code,...args],{windowsHide:true,stdio:['ignore','pipe','ignore']});let data='';
  p.stdout.on('data',d=>data+=d);p.on('error',reject);p.on('close',status=>{try{assert.equal(status,0);resolve(JSON.parse(data))}catch{reject(new Error('Isolated heartbeat worker failed'))}});
 });
}
test('heartbeats persist a bounded lifetime, preserve fencing and prevent competing claims',async t=>{
 let clock=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>clock}),job=request(f),held=claim(f,job);
 clock=new Date(clock.getTime()+900);const beat=heartbeatJob(f.ops,held,{extendMs:60000});
 assert.equal(beat.accepted,true);assert.equal(beat.fence,held.fence);assert.equal(beat.heartbeatCount,1);
 assert.equal(Date.parse(beat.leaseUntil)-clock.getTime(),60000);assert.equal(claim(f,job,{workerId:'worker-b'}),null);
 for(let i=0;i<2;i++){clock=new Date(clock.getTime()+50000);assert.equal(heartbeatJob(f.ops,held,{extendMs:60000}).accepted,true);}
 const current=fresh(f,job);assert.equal(Date.parse(current.leaseUntil)-Date.parse(current.leaseStartedAt),runtimeLeasePolicy.maxLifetimeMs);
 clock=new Date(Date.parse(current.leaseDeadlineAt));assert.deepEqual(heartbeatJob(f.ops,held),{accepted:false,reason:'LEASE_STALE'});
 const reclaimed=claim(f,job,{workerId:'worker-b'});assert.equal(reclaimed.fence,held.fence+1);
 assert.equal(heartbeatJob(f.ops,held).accepted,false);
});
test('heartbeat revalidates current human authority and policy before extending',async t=>{
 const f=await setup(t),job=request(f),held=claim(f,job);
 f.command(f.manager,'governance:update',null,{enabled:false,disabledTools:[],reason:'Human pauses advisory workers'});
 assert.deepEqual(heartbeatJob(f.ops,held),{accepted:false,reason:'POLICY_BLOCKED'});
 const current=fresh(f,job);assert.equal(current.status,'blocked');assert.equal(current.leaseUntil,null);assert.equal(current.fence,held.fence+1);
 const f2=await setup(t),other=request(f2),otherClaim=claim(f2,other);
 const actor={...f2.store.principal(f2.manager.id),active:false};
 f2.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify(actor),actor.id);
 assert.equal(heartbeatJob(f2.ops,otherClaim).reason,'AUTHORITY_CHANGED');
});
test('heartbeat rejects changed loads, wrong worker, bounds and cross-tenant lookups without producing decisions',async t=>{
 const f=await setup(t),load=f.createLoad(),job=f.command(f.manager,'orchestration:request',load),held=claim(f,job);
 assert.equal(heartbeatJob(f.ops,{...held,workerId:'different-worker'}).reason,'LEASE_STALE');
 assert.throws(()=>heartbeatJob(f.ops,held,{extendMs:60001}));
 assert.throws(()=>heartbeatJob(f.ops,{...held,tenantId:f.outsider.tenantId}),e=>e.code==='NOT_FOUND');
 f.command(f.dispatcher,'load:validate',load);
 assert.equal(heartbeatJob(f.ops,held).reason,'LOAD_CHANGED');assert.equal(f.store.list('agentdecision',f.manager.tenantId).length,0);
});
test('restarted store retains the heartbeat and reclaim requires expiry before a new fence can complete',async t=>{
 let clock=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>clock}),job=request(f),held=claim(f,job),oldOutput=executeAdvisory(f.ops,held);
 clock=new Date(clock.getTime()+500);heartbeatJob(f.ops,held,{extendMs:2000});
 const store=new OperationsStore(f.path),ops=new Operations(store,{now:()=>clock,extensions:createRuntimeExtensions()});
 try{
  assert.equal(store.get('orchestration',job.id,f.manager.tenantId).heartbeatCount,1);
  assert.equal(claimJob(ops,{...held,workerId:'restarted'}),null);
  clock=new Date(clock.getTime()+2001);const recovered=claimJob(ops,{...held,workerId:'restarted'});
  assert.equal(recovered.fence,held.fence+1);assert.equal(completeJob(ops,held,oldOutput).reason,'LEASE_STALE');
  assert.equal(completeJob(ops,recovered,executeAdvisory(ops,recovered)).accepted,true);
  assert.equal(store.list('agentdecision',f.manager.tenantId).length,1);
 }finally{store.close()}
});
test('independent concurrent heartbeat and reclaim transactions cannot both own an expired lease',async t=>{
 const initial=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>initial}),job=request(f),held=claim(f,job);
 const code="import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {heartbeatJob,claimJob} from './domain/operations-runtime.mjs';const s=new OperationsStore(process.argv[1]),ops=new Operations(s,{now:()=>new Date('2026-11-02T14:00:01.001Z')}),c=JSON.parse(process.argv[2]);console.log(JSON.stringify(process.argv[3]==='heartbeat'?heartbeatJob(ops,c):claimJob(ops,{...c,workerId:'reclaimed'})));s.close();";
 const [beat,reclaimed]=await Promise.all(['heartbeat','claim'].map(mode=>child(code,[f.path,JSON.stringify(held),mode])));
 assert.deepEqual(beat,{accepted:false,reason:'LEASE_STALE'});assert.equal(reclaimed.fence,held.fence+1);
 assert.equal(fresh(f,job).leaseOwner,'reclaimed');assert.equal(fresh(f,job).attempts,2);
});
test('actual async worker renews leases outside adapter transactions and clears timer at completion',async t=>{
 const f=await setup(t),load=f.createLoad(),job=f.command(f.manager,'connector:request',load,{capability:'mapping',input:{source:'local_fixture',distanceMiles:60,averageMph:60,handlingMinutes:0,departureAt:'2026-11-02T14:00:00.000Z'}});
 let competing;const other=new OperationsStore(f.path);
 try{
  const otherOps=new Operations(other);
  const adapters={...localConnectorAdapters,mapping:{...localConnectorAdapters.mapping,execute:async context=>{
   await delay(450);competing=claimJob(otherOps,{tenantId:f.manager.tenantId,kind:'connectorjob',jobId:job.id,workerId:'competing',leaseMs:300});
   return localConnectorAdapters.mapping.execute(context);
  }}};
  assert.equal(await runRuntimeTick(f.ops,{adapters,leaseMs:300,heartbeatMs:50}),1);assert.equal(competing,null);
  const completed=fresh(f,job);assert.equal(completed.status,'completed');assert.ok(completed.heartbeatCount>=2);
  assert.equal(f.store.list('connectorresult',f.manager.tenantId).length,1);
  await delay(100);assert.equal(fresh(f,job).version,completed.version);
 }finally{other.close()}
});
test('heartbeat audit records lease metadata only and cannot resume a cancelled job',async t=>{
 const f=await setup(t),job=request(f),held=claim(f,job);
 heartbeatJob(f.ops,held);
 const audit=f.store.db.prepare("SELECT detail FROM audit WHERE action='runtime:heartbeat'").all();assert.equal(audit.length,1);
 const detail=JSON.parse(audit[0].detail);assert.equal(detail.fence,held.fence);assert.equal(Object.hasOwn(detail,'input'),false);assert.equal(Object.hasOwn(detail,'result'),false);
 f.command(f.manager,'orchestration:cancel',fresh(f,job),{reason:'Human stops this worker'});
 assert.equal(heartbeatJob(f.ops,held).reason,'LEASE_STALE');
 assert.equal(fresh(f,job).status,'cancelled');
});
