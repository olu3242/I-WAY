import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionBoundOfflineQueue} from '../domain/driver-offline-session.mjs';

const identity={actorId:'driver_1',tenantId:'tenant_1',sessionId:'session_1'};
function setup(entries){
 const pending=[...entries],sent=[];
 const storage={
  async list(){return [...pending];},
  async acknowledge(key){const index=pending.findIndex(e=>e.idempotencyKey===key);if(index>=0)pending.splice(index,1);},
  async close(){}
 };
 let session={...identity,active:true};
 return {queue:createSessionBoundOfflineQueue({storage,identity,readSession:async()=>session}),pending,sent,setSession:s=>session=s};
}
const entries=[{idempotencyKey:'a',action:'load:accept',expectedVersion:1},{idempotencyKey:'b',action:'load:pickup',expectedVersion:2}];
test('B16 ordered replay confirms receipts in sequence and removes only confirmed',async()=>{
 const f=setup(entries);
 const result=await f.queue.replay(async command=>{f.sent.push(command.idempotencyKey);return {confirmed:true,idempotencyKey:command.idempotencyKey};});
 assert.deepEqual(f.sent,['a','b']);assert.equal(result.status,'confirmed_by_server');assert.equal(f.pending.length,0);
});
test('B17 network interruption retains unresolved commands and stable keys',async()=>{
 const f=setup(entries);let count=0;
 const result=await f.queue.replay(async command=>{count++;if(count===2)throw Error('offline');return {confirmed:true,idempotencyKey:command.idempotencyKey};});
 assert.equal(result.status,'needs_attention');assert.deepEqual(f.pending.map(e=>e.idempotencyKey),['b']);
});
test('B18 version conflict is not treated as confirmation',async()=>{
 const f=setup(entries);
 const result=await f.queue.replay(async()=>({confirmed:false,reason:'VERSION_CONFLICT'}));
 assert.equal(result.status,'needs_attention');assert.equal(f.pending.length,2);
});
test('B16 duplicate concurrent replay is rejected',async()=>{
 const f=setup(entries);let release;
 const gate=new Promise(resolve=>release=resolve);
 const first=f.queue.replay(async command=>{await gate;return {confirmed:true,idempotencyKey:command.idempotencyKey};});
 await assert.rejects(f.queue.replay(async()=>({confirmed:true})),/OFFLINE_REPLAY_IN_PROGRESS/);
 release();await first;assert.equal(f.pending.length,0);
});
test('B18 account switch during send preserves unresolved command',async()=>{
 const f=setup(entries);
 await assert.rejects(f.queue.replay(async command=>{f.setSession({...identity,actorId:'driver_2'});return {confirmed:true,idempotencyKey:command.idempotencyKey};}),/OFFLINE_SESSION_MISMATCH/);
 assert.equal(f.pending.length,2);
});
