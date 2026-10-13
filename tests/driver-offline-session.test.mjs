import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionBoundOfflineQueue} from '../domain/driver-offline-session.mjs';

const identity={actorId:'driver_1',tenantId:'tenant_1',sessionId:'session_1'};
function fixture(){
 const commands=[{idempotencyKey:'key_1'},{idempotencyKey:'key_2'}];
 const storage={
  async list(){return [...commands];},
  async enqueue(entry){commands.push(entry);},
  async acknowledge(key){const i=commands.findIndex(c=>c.idempotencyKey===key);if(i>=0)commands.splice(i,1);},
  async close(){}
 };
 let session={...identity,active:true};
 const queue=createSessionBoundOfflineQueue({storage,identity,readSession:async()=>session});
 return {queue,commands,setSession:value=>{session=value;}};
}
test('B15 logout blocks subsequent queue access without erasing commands',async()=>{
 const f=fixture();f.setSession({...identity,active:false});
 await assert.rejects(f.queue.list(),/OFFLINE_SESSION_MISMATCH/);
 assert.equal(f.commands.length,2);
});
test('B15 account switch denies access to previous actor queue',async()=>{
 const f=fixture();f.setSession({...identity,actorId:'driver_2'});
 await assert.rejects(f.queue.enqueue({idempotencyKey:'key_3'}),/OFFLINE_SESSION_MISMATCH/);
 assert.equal(f.commands.length,2);
});
test('B15 expired session prevents any replay send',async()=>{
 const f=fixture();f.setSession(null);let sent=0;
 await assert.rejects(f.queue.replay(async()=>{sent++;}),/OFFLINE_SESSION_MISMATCH/);
 assert.equal(sent,0);
});
test('B15 session switch between commands stops replay',async()=>{
 const f=fixture();let sent=0;
 await assert.rejects(f.queue.replay(async entry=>{
  sent++;if(sent===1)f.setSession({...identity,sessionId:'session_2'});
  return {confirmed:true,idempotencyKey:entry.idempotencyKey};
 }),/OFFLINE_SESSION_MISMATCH/);
 assert.equal(sent,1);
 assert.equal(f.commands.length,2);
});
test('B15 ambiguous response retains queued work for review',async()=>{
 const f=fixture();
 const result=await f.queue.replay(async()=>({confirmed:false}));
 assert.equal(result.status,'needs_attention');
 assert.equal(f.commands.length,2);
});
test('B15 invalidation locks the queue',async()=>{
 const f=fixture();await f.queue.invalidate();
 await assert.rejects(f.queue.list(),/OFFLINE_SESSION_LOCKED/);
});
