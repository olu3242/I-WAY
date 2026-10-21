import test from 'node:test';
import assert from 'node:assert/strict';
import {createCertifiedNonceCleanupWorker} from '../server/operations-certified-nonce-cleanup-worker.experimental.mjs';
test('B433 denies cleanup when fence no longer belongs to worker',async()=>{
 let cleaned=0,finalized=0;
 const jobs={claim:async()=>[{invitationId:'i',tenantId:'t',fenceToken:2}],
  ownsLease:async()=>true,renewLease:async()=>true,ownsFence:async()=>false,
  complete:async()=>{throw Error('LEGACY_COMPLETE_FORBIDDEN');},
  finalizeConsumedChallenges:async()=>{finalized++;return true;}};
 const worker=createCertifiedNonceCleanupWorker({jobs,reconciler:{reconcile:async()=>{cleaned++;return {reconciled:true};}}});
 assert.deepEqual(await worker.runOnce(),{scanned:1,completed:0,skipped:1,failed:0});
 assert.equal(cleaned,0);assert.equal(finalized,0);
});
test('B433 requires atomic finalization for fenced successful cleanup',async()=>{
 let finalized=0;
 const jobs={claim:async()=>[{invitationId:'i',tenantId:'t',fenceToken:3}],
  ownsLease:async()=>true,renewLease:async()=>true,ownsFence:async()=>true,
  complete:async()=>{throw Error('LEGACY_COMPLETE_FORBIDDEN');},
  finalizeConsumedChallenges:async()=>{finalized++;return true;}};
 const worker=createCertifiedNonceCleanupWorker({jobs,reconciler:{reconcile:async()=>({reconciled:true})}});
 assert.equal((await worker.runOnce()).completed,1);
 assert.equal(finalized,1);
});
test('B433 rejects unconfigured finalization dependency',()=>{
 assert.throws(()=>createCertifiedNonceCleanupWorker({jobs:{claim:async()=>[]},reconciler:{reconcile:async()=>({reconciled:true})}}),/CERTIFIED_NONCE_WORKER_DEPENDENCIES_REQUIRED/);
});
