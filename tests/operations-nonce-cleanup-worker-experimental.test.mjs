import test from 'node:test';
import assert from 'node:assert/strict';
import {createNonceCleanupWorker} from '../server/operations-nonce-cleanup-worker.experimental.mjs';
const scopes=[{invitationId:'a',tenantId:'t'},{invitationId:'b',tenantId:'t'},{invitationId:'c',tenantId:'t'}];
test('bounded worker completes only reconciled jobs and isolates failures',async()=>{
 const done=[],logs=[];
 const worker=createNonceCleanupWorker({
  jobs:{pending:async({limit})=>scopes.slice(0,limit),complete:async scope=>{done.push(scope.invitationId);return true;}},
  reconciler:{reconcile:async scope=>{
   if(scope.invitationId==='b')throw Error('SENSITIVE_TOKEN_NOT_FOR_LOGS');
   return {reconciled:scope.invitationId==='a'};
  }},
  logger:entry=>logs.push(entry)
 });
 assert.deepEqual(await worker.runOnce({limit:3}),{scanned:3,completed:1,skipped:1,failed:1});
 assert.deepEqual(done,['a']);
 assert.equal(logs.length,1);
 assert.equal(JSON.stringify(logs).includes('SENSITIVE_TOKEN_NOT_FOR_LOGS'),false);
});
test('worker rejects unbounded batches',async()=>{
 const worker=createNonceCleanupWorker({jobs:{pending:async()=>[],complete:async()=>true},reconciler:{reconcile:async()=>({reconciled:true})}});
 await assert.rejects(worker.runOnce({limit:101}),/INVALID_NONCE_WORKER_LIMIT/);
});
test('job completion failure stays pending for retry',async()=>{
 const worker=createNonceCleanupWorker({
  jobs:{pending:async()=>[scopes[0]],complete:async()=>false},
  reconciler:{reconcile:async()=>({reconciled:true})}
 });
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:0,failed:1});
});
