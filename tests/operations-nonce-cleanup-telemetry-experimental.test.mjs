import test from 'node:test';
import assert from 'node:assert/strict';
import {createNonceCleanupTelemetry} from '../server/operations-nonce-cleanup-telemetry.experimental.mjs';
test('B444 telemetry strips invitation, nonce and token fields',()=>{
 const events=[];
 const telemetry=createNonceCleanupTelemetry({emit:event=>events.push(event)});
 telemetry.record({event:'NONCE_CLEANUP_RETRY_REQUIRED',invitationId:'private-id',nonce:'raw-secret',token:'jwt-secret',error:new Error('sensitive')});
 telemetry.record({event:'NONCE_CLEANUP_COMPLETED',subject:'private-subject'});
 telemetry.record({event:'NONCE_CLEANUP_SKIPPED',tenantId:'private-tenant'});
 assert.deepEqual(telemetry.snapshot(),{completed:1,skipped:1,failed:1});
 const logged=JSON.stringify(events);
 for(const secret of ['private-id','raw-secret','jwt-secret','sensitive','private-subject','private-tenant'])
  assert.equal(logged.includes(secret),false,secret);
 assert.deepEqual(events.map(e=>e.status),['failed','completed','skipped']);
});
test('B444 rejects unknown telemetry events',()=>{
 const telemetry=createNonceCleanupTelemetry({emit:()=>{}});
 assert.throws(()=>telemetry.record({event:'RAW_TOKEN'}),/INVALID_NONCE_TELEMETRY_EVENT/);
});
