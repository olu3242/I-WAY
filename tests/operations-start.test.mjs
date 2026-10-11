import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures,runFeatureTick} from '../domain/operations-features.mjs';
import {startLocalOperations} from '../scripts/operations-start.mjs';

async function setup(t){
 const f=await fixture(t,createOperationsFeatures()),load=f.createLoad(),job=f.command(f.manager,'orchestration:request',load);
 return {...f,load,job};
}
async function until(check,{timeoutMs=12000}={}){
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){const value=check();if(value)return value;await delay(50);}
 throw new Error('The isolated local operations process did not reach the expected checkpoint');
}
function childExit(child){return new Promise(accept=>{if(child.exitCode!==null||child.signalCode!==null)accept();else child.once('exit',accept)})}

test('actual operations CLI starts on loopback and schedules all five persisted advisory checkpoints',async t=>{
 const f=await setup(t);
 const child=spawn(process.execPath,['scripts/operations-start.mjs'],{
  cwd:process.cwd(),env:{...process.env,IWAY_OPS_DB:f.path,IWAY_OPS_PORT:'0'},windowsHide:true,stdio:['ignore','pipe','pipe']
 });
 let output='',startError=null,stderr='';
 child.stdout.on('data',chunk=>{output+=chunk});
 child.stderr.on('data',chunk=>{stderr+=chunk});
 child.on('error',error=>{startError=error});
 try{
  const port=await until(()=>{
   if(startError||child.exitCode!==null)throw new Error('Isolated local operations startup failed');
   const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);return match?Number(match[1]):null;
  });
  const response=await fetch('http://127.0.0.1:'+port+'/api/ops/state');assert.equal(response.status,401);
  const complete=await until(()=>{
   const job=f.store.get('orchestration',f.job.id,f.manager.tenantId);return job.status==='completed'?job:null;
  });
  assert.equal(complete.checkpoint,5);assert.equal(complete.decisionIds.length,5);
  const decisions=f.store.list('agentdecision',f.manager.tenantId);assert.equal(decisions.length,5);
  assert.deepEqual(decisions.map(d=>d.role),['dispatch','tracking','documents','exceptions','finance']);
  assert.ok(decisions.every(d=>d.provenance.model===null&&d.consequentialAction===false));
  assert.equal(f.store.get('load',f.load.id,f.manager.tenantId).status,'draft');
  assert.equal(stderr,'');
 }finally{
  const exited=childExit(child);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');
  await exited;child.stdout.destroy();child.stderr.destroy();
 }
});

test('graceful lifecycle stops HTTP and awaits one in-flight real checkpoint before closing SQLite',async t=>{
 const f=await setup(t);let entered,release,calls=0;
 const began=new Promise(accept=>{entered=accept}),blocked=new Promise(accept=>{release=accept});
 const app=await startLocalOperations({databasePath:f.path,port:0,intervalMs:10,runTick:async ops=>{
  calls++;entered();await blocked;return runFeatureTick(ops);
 }});
 let stop=null;
 try{
  await began;await delay(60);assert.equal(calls,1,'Scheduler must remain single-flight');
  const port=app.server.address().port;
  let stopped=false;stop=app.shutdown().then(()=>{stopped=true});
  assert.equal(app.shutdown(),app.shutdown(),'Shutdown calls share the same promise');
  await delay(30);assert.equal(stopped,false,'Shutdown must wait for the checkpoint');
  assert.equal(app.store.db.prepare('SELECT 1 AS ok').get().ok,1,'Persistence remains available while the checkpoint is in flight');
  await assert.rejects(()=>fetch('http://127.0.0.1:'+port+'/api/ops/state'));
  release();await stop;
  assert.equal(calls,1);assert.equal(f.store.get('orchestration',f.job.id,f.manager.tenantId).checkpoint,1);
  assert.equal(f.store.list('agentdecision',f.manager.tenantId).length,1);
  assert.throws(()=>app.store.db.prepare('SELECT 1'));
 }finally{
  release();await (stop??app.shutdown());
 }
});

test('graceful shutdown also awaits a failed checkpoint and logs only the fixed sanitized message',async t=>{
 const f=await setup(t);let entered,release;
 const began=new Promise(accept=>{entered=accept}),blocked=new Promise(accept=>{release=accept}),messages=[];
 const app=await startLocalOperations({databasePath:f.path,port:0,intervalMs:10,logger:{error:message=>messages.push(message)},runTick:async()=>{
  entered();await blocked;throw new Error('Illustrative private failure detail must not appear in logs');
 }});
 try{
  await began;const stop=app.shutdown();release();await stop;
  assert.deepEqual(messages,['Local workflow checkpoint deferred; no partial write committed.']);
  assert.equal(f.store.get('orchestration',f.job.id,f.manager.tenantId).checkpoint,0);
  assert.throws(()=>app.store.db.prepare('SELECT 1'));
 }finally{release();await app.shutdown()}
});
