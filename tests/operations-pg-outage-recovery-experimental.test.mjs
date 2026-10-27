// B440: deterministic PostgreSQL outage/recovery regression for the strict
// worker. No external services or production access are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createCertifiedNonceCleanupWorker} from '../server/operations-certified-nonce-cleanup-worker.experimental.mjs';
test('B440 outage after lease claim preserves pending job and retries after recovery',async()=>{
 const ownerId=randomUUID(),scope={invitationId:'fixture-i',tenantId:'fixture-t',fenceToken:1};
 let available=true,completed=false,attempts=0;
 const jobs={
  async claim(){if(!available)throw Error('DB_UNAVAILABLE');return completed?[]:[scope];},
  async ownsLease(){if(!available)throw Error('DB_UNAVAILABLE');return !completed;},
  async renewLease(){if(!available)throw Error('DB_UNAVAILABLE');return !completed;},
  async ownsFence(){if(!available)throw Error('DB_UNAVAILABLE');return !completed;},
  async finalizeConsumedChallenges(){if(!available)throw Error('DB_UNAVAILABLE');completed=true;return true;},
  async complete(){throw Error('LEGACY_COMPLETION_FORBIDDEN');}
 };
 const reconciler={async reconcile(){attempts++;return {reconciled:true};}};
 const events=[];
 const worker=createCertifiedNonceCleanupWorker({jobs,reconciler,logger:e=>events.push(e)});
 available=false;
 await assert.rejects(worker.runOnce({ownerId}),/DB_UNAVAILABLE/);
 assert.equal(completed,false);
 available=true;
 const first=await worker.runOnce({ownerId});
 assert.deepEqual(first,{scanned:1,completed:1,skipped:0,failed:0});
 assert.equal(attempts,1);
 assert.deepEqual(await createCertifiedNonceCleanupWorker({jobs,reconciler}).runOnce({ownerId}),{scanned:0,completed:0,skipped:0,failed:0});
 assert.equal(events.length,0);
});
test('B440 outage during finalization never reports completed, new worker recovers',async()=>{
 const ownerId=randomUUID(),scope={invitationId:'fixture-i',tenantId:'fixture-t',fenceToken:2};
 let outage=true,completed=false,finalizationCalls=0;
 const jobs={
  claim:async()=>completed?[]:[scope],
  ownsLease:async()=>true,renewLease:async()=>true,ownsFence:async()=>true,
  finalizeConsumedChallenges:async()=>{finalizationCalls++;if(outage)throw Error('DB_UNAVAILABLE');completed=true;return true;},
  complete:async()=>{throw Error('LEGACY_COMPLETION_FORBIDDEN');}
 };
 const reconciler={reconcile:async()=>({reconciled:true})};
 const errors=[];
 const first=await createCertifiedNonceCleanupWorker({jobs,reconciler,logger:e=>errors.push(e)}).runOnce({ownerId});
 assert.deepEqual(first,{scanned:1,completed:0,skipped:0,failed:1});
 assert.equal(completed,false);
 assert.equal(errors[0]?.errorCode,'CLEANUP_FAILED');
 assert.equal(JSON.stringify(errors).includes('DB_UNAVAILABLE'),false);
 outage=false;
 const second=await createCertifiedNonceCleanupWorker({jobs,reconciler}).runOnce({ownerId});
 assert.deepEqual(second,{scanned:1,completed:1,skipped:0,failed:0});
 assert.equal(finalizationCalls,2);
});
