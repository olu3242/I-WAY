import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOfflineCommand,validateOfflineQueue,replayOfflineCommands} from '../domain/driver-offline-replay.mjs';
const context={tenantId:'tenant_1',actorId:'driver_1'};
const entry=(overrides={})=>({schemaVersion:1,...context,action:'load:accept',resourceId:'load_1',expectedVersion:1,idempotencyKey:'550e8400-e29b-41d4-a716-446655440000',createdAt:1000,payload:{},...overrides});
test('validates a minimal actor-bound command',()=>assert.equal(validateOfflineCommand(entry(),context,1000).action,'load:accept'));
test('blocks cross tenant replay',()=>assert.throws(()=>validateOfflineCommand(entry({tenantId:'tenant_2'}),context,1000),/IDENTITY/));
test('blocks cross actor replay',()=>assert.throws(()=>validateOfflineCommand(entry({actorId:'driver_2'}),context,1000),/IDENTITY/));
test('blocks sensitive payloads and unsupported actions',()=>{
 assert.throws(()=>validateOfflineCommand(entry({payload:{proofReference:'secret'}}),context,1000),/PAYLOAD/);
 assert.throws(()=>validateOfflineCommand(entry({action:'load:deliver'}),context,1000),/UNSUPPORTED/);
});
test('blocks expired, future and malformed commands',()=>{
 assert.throws(()=>validateOfflineCommand(entry({createdAt:0}),context,90000000),/EXPIRED/);
 assert.throws(()=>validateOfflineCommand(entry({createdAt:2000}),context,1000),/EXPIRED/);
 assert.throws(()=>validateOfflineCommand(entry({expectedVersion:0}),context,1000),/INVALID/);
});
test('blocks duplicate keys',()=>assert.throws(()=>validateOfflineQueue([entry(),entry()],context,1000),/DUPLICATE/));
test('confirms only matching server receipt and preserves original key',async()=>{
 const sent=[];
 const result=await replayOfflineCommands({entries:[entry()],context,now:1000,send:async c=>{sent.push(c);return {confirmed:true,idempotencyKey:c.idempotencyKey};}});
 assert.equal(result.status,'confirmed_by_server');assert.equal(sent[0].idempotencyKey,entry().idempotencyKey);
});
test('failed and ambiguous responses remain pending',async()=>{
 for(const send of [async()=>{throw new Error('network');},async()=>({confirmed:true,idempotencyKey:'wrong'})]){
  const result=await replayOfflineCommands({entries:[entry()],context,now:1000,send});
  assert.equal(result.status,'needs_attention');assert.equal(result.remaining.length,1);
 }
});
