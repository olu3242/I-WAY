import test from 'node:test';
import assert from 'node:assert/strict';
import {createNonceCleanupWorker} from '../server/operations-nonce-cleanup-worker.experimental.mjs';
const scopes=[{invitationId:'a',tenantId:'t'},{invitationId:'b',tenantId:'t'},{invitationId:'c',tenantId:'t'}];
test('bounded worker completes only reconciled jobs and isolates failures',async()=>{
 const done=[],logs=[];
 const worker=createNonceCleanupWorker({
  jobs:{ownsLease:async()=>true,renewLease:async()=>true,claim:async({limit})=>scopes.slice(0,limit),complete:async scope=>{done.push(scope.invitationId);return true;}},
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
 const worker=createNonceCleanupWorker({jobs:{ownsLease:async()=>true,renewLease:async()=>true,claim:async()=>[],complete:async()=>true},reconciler:{reconcile:async()=>({reconciled:true})}});
 await assert.rejects(worker.runOnce({limit:101}),/INVALID_NONCE_WORKER_LIMIT/);
});
test('job completion failure stays pending for retry',async()=>{
 const worker=createNonceCleanupWorker({
  jobs:{ownsLease:async()=>true,renewLease:async()=>true,claim:async()=>[scopes[0]],complete:async()=>false},
  reconciler:{reconcile:async()=>({reconciled:true})}
 });
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:0,failed:1});
});

test('B424 stale lease blocks cleanup execution',async()=>{
 let invoked=0;
 const worker=createNonceCleanupWorker({
  jobs:{claim:async()=>[{invitationId:'stale',tenantId:'tenant'}],ownsLease:async()=>false,renewLease:async()=>true,complete:async()=>{throw Error('must not complete');}},
  reconciler:{reconcile:async()=>{invoked++;return {reconciled:true};}}
 });
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:1,failed:0});
 assert.equal(invoked,0);
});

test('B425 rejected renewal blocks nonce cleanup',async()=>{
 let invoked=0;
 const worker=createNonceCleanupWorker({
  jobs:{claim:async()=>[{invitationId:'stale',tenantId:'tenant'}],
   ownsLease:async()=>true,renewLease:async()=>false,complete:async()=>{throw Error('unexpected');}},
  reconciler:{reconcile:async()=>{invoked++;return {reconciled:true};}}
 });
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:1,failed:0});
 assert.equal(invoked,0);
});

test('B427 forwards database fence generation and owner to reconciler',async()=>{
 let received;
 const worker=createNonceCleanupWorker({
  jobs:{claim:async()=>[{invitationId:'invite',tenantId:'tenant',fenceToken:7}],
   ownsLease:async()=>true,renewLease:async()=>true,complete:async()=>true},
  reconciler:{reconcile:async scope=>{received=scope;return {reconciled:true};}}
 });
 const ownerId='11111111-1111-4111-8111-111111111111';
 assert.equal((await worker.runOnce({ownerId})).completed,1);
 assert.deepEqual(received,{invitationId:'invite',tenantId:'tenant',fenceToken:7,ownerId});
});

test('B431 optional atomic database finalization requires fence and never calls legacy complete',async()=>{
 const calls=[];
 const worker=createNonceCleanupWorker({
  finalizeDatabase:true,
  jobs:{
   claim:async()=>[{invitationId:'invite',tenantId:'tenant',fenceToken:9}],
   ownsLease:async()=>true,renewLease:async()=>true,
   complete:async()=>{throw Error('LEGACY_COMPLETE_CALLED');},
   finalizeConsumedChallenges:async scope=>{calls.push(scope);return true;}
  },
  reconciler:{reconcile:async()=>({reconciled:true})}
 });
 const ownerId='11111111-1111-4111-8111-111111111111';
 assert.equal((await worker.runOnce({ownerId})).completed,1);
 assert.deepEqual(calls,[{invitationId:'invite',tenantId:'tenant',fenceToken:9,ownerId}]);
});

test('B432 atomic finalization rejection leaves job uncompleted',async()=>{
 let legacyCompletions=0,finalizations=0;
 const worker=createNonceCleanupWorker({
  finalizeDatabase:true,
  jobs:{claim:async()=>[{invitationId:'invite',tenantId:'tenant',fenceToken:4}],
   ownsLease:async()=>true,renewLease:async()=>true,
   complete:async()=>{legacyCompletions++;return true;},
   finalizeConsumedChallenges:async()=>{finalizations++;return false;}},
  reconciler:{reconcile:async()=>({reconciled:true})}
 });
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:0,failed:1});
 assert.equal(finalizations,1);
 assert.equal(legacyCompletions,0);
});
test('B432 failed atomic finalization can be retried by a new worker',async()=>{
 let attempt=0;
 const jobs={claim:async()=>[{invitationId:'invite',tenantId:'tenant',fenceToken:5}],
  ownsLease:async()=>true,renewLease:async()=>true,
  complete:async()=>{throw Error('legacy path');},
  finalizeConsumedChallenges:async()=>++attempt>1};
 const reconciler={reconcile:async()=>({reconciled:true})};
 const first=createNonceCleanupWorker({jobs,reconciler,finalizeDatabase:true});
 const second=createNonceCleanupWorker({jobs,reconciler,finalizeDatabase:true});
 assert.equal((await first.runOnce()).failed,1);
 assert.equal((await second.runOnce()).completed,1);
});
