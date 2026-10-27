// B422 isolated two-connection PostgreSQL job lease race.
// Run only against disposable fixture database.
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
import {createEphemeralNonceStore} from '../server/operations-ephemeral-nonce-store.experimental.mjs';
import {createPgNonceCustody} from '../server/operations-pg-nonce-custody.experimental.mjs';
const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID();
const clients=[new Client(),new Client(),new Client()];
for(const client of clients)await client.connect();
try{
 await clients[0].query(`INSERT INTO operations_onboarding.invitations
  (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
  VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'VERIFIED',now()+interval '1 hour')`,
  [invitationId,tenantId,actorId,invitationId+'@example.invalid','e'.repeat(64)]);
 const admin=createPgNonceCleanupJobs((sql,args)=>clients[0].query(sql,args));
 await admin.enqueue({invitationId,tenantId});
 const ownerA=randomUUID(),ownerB=randomUUID();
 const a=createPgNonceCleanupJobs((sql,args)=>clients[1].query(sql,args));
 const b=createPgNonceCleanupJobs((sql,args)=>clients[2].query(sql,args));
 const [claimA,claimB]=await Promise.all([a.claim({ownerId:ownerA}),b.claim({ownerId:ownerB})]);
 if(claimA.length+claimB.length!==1)throw Error('B422_DUPLICATE_LEASE_CLAIM');
 const originalFence=(claimA[0]||claimB[0]).fenceToken;
 const durableCustody=createPgNonceCustody((sql,args)=>clients[0].query(sql,args));
 if(await durableCustody.consumedCount({invitationId,tenantId})!==0)throw Error('B437_UNEXPECTED_CONSUMED_NONCE');
 if(!Number.isSafeInteger(originalFence)||originalFence<1)throw Error('B426_MISSING_FENCE_TOKEN');
 const winner=claimA.length?{jobs:a,ownerId:ownerA}:{jobs:b,ownerId:ownerB};
 const loser=claimA.length?{jobs:b,ownerId:ownerB}:{jobs:a,ownerId:ownerA};
 const nonceStore=createEphemeralNonceStore({authorizeFence:scope=>admin.ownsFence(scope)});
 const nonce='b429-fixture-nonce-0123456789';
 await nonceStore.storeNonce({invitationId,tenantId,nonce});
 await nonceStore.setFence({invitationId,tenantId,ownerId:winner.ownerId,fenceToken:originalFence});
 if(await loser.jobs.complete({invitationId,tenantId,ownerId:loser.ownerId}))
  throw Error('B422_NON_OWNER_COMPLETION_ALLOWED');
 // Simulate an interrupted worker whose lease has expired.
 await clients[0].query(`UPDATE operations_onboarding.nonce_cleanup_jobs
  SET lease_until=now()-interval '1 second' WHERE invitation_id=$1`,[invitationId]);
 const recovered=await loser.jobs.claim({ownerId:loser.ownerId});
 if(recovered.length!==1||recovered[0].invitationId!==invitationId||recovered[0].fenceToken<=originalFence)
  throw Error('B423_EXPIRED_LEASE_NOT_RECLAIMED');
 try{
  await nonceStore.clearNonceFenced({invitationId,tenantId,ownerId:winner.ownerId,fenceToken:originalFence});
  throw Error('B429_STALE_OWNER_DELETED_NONCE');
 }catch(error){if(error.message!=='NONCE_FENCE_NOT_AUTHORIZED')throw error;}
 if(await nonceStore.readNonce({invitationId,tenantId})!==nonce)throw Error('B429_NONCE_MISSING_AFTER_STALE_DELETE');
 await nonceStore.setFence({invitationId,tenantId,ownerId:loser.ownerId,fenceToken:recovered[0].fenceToken});
 await nonceStore.clearNonceFenced({invitationId,tenantId,ownerId:loser.ownerId,fenceToken:recovered[0].fenceToken});
 if(await nonceStore.readNonce({invitationId,tenantId})!==null)throw Error('B429_NEW_OWNER_COULD_NOT_CLEAR_NONCE');
 if(await winner.jobs.ownsLease({invitationId,tenantId,ownerId:winner.ownerId}))
  throw Error('B424_STALE_OWNER_LEASE_VALID');
 if(!await loser.jobs.ownsLease({invitationId,tenantId,ownerId:loser.ownerId}))
  throw Error('B424_RECOVERY_OWNER_LEASE_INVALID');
 if(await winner.jobs.complete({invitationId,tenantId,ownerId:winner.ownerId}))
  throw Error('B423_STALE_OWNER_COMPLETION_ALLOWED');
 if(await winner.jobs.renewLease({invitationId,tenantId,ownerId:winner.ownerId}))
  throw Error('B425_STALE_OWNER_RENEWED_LEASE');
 if(!await loser.jobs.renewLease({invitationId,tenantId,ownerId:loser.ownerId,leaseSeconds:30}))
  throw Error('B425_VALID_OWNER_RENEWAL_FAILED');
 // A VERIFIED (not ACTIVE) invitation cannot be atomically finalized.
 if(await loser.jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:loser.ownerId,fenceToken:recovered[0].fenceToken}))
  throw Error('B432_UNACTIVATED_INVITATION_FINALIZED');
 const pendingBefore=await clients[0].query('SELECT state FROM operations_onboarding.nonce_cleanup_jobs WHERE invitation_id=$1',[invitationId]);
 if(pendingBefore.rows[0]?.state!=='PENDING')throw Error('B432_REJECTED_FINALIZATION_COMPLETED_JOB');
 if(!await loser.jobs.complete({invitationId,tenantId,ownerId:loser.ownerId}))
  throw Error('B423_RECOVERY_OWNER_COMPLETION_FAILED');
 if((await admin.pending()).some(job=>job.invitationId===invitationId))
  throw Error('B422_COMPLETED_JOB_PENDING');
 console.log('PASS: B422/B423 two-session job claiming, expired lease recovery, stale-owner denial');
}finally{
 for(const client of clients)await client.end();
}
