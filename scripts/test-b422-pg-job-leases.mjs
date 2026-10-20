// B422 isolated two-connection PostgreSQL job lease race.
// Run only against disposable fixture database.
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
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
 const winner=claimA.length?{jobs:a,ownerId:ownerA}:{jobs:b,ownerId:ownerB};
 const loser=claimA.length?{jobs:b,ownerId:ownerB}:{jobs:a,ownerId:ownerA};
 if(await loser.jobs.complete({invitationId,tenantId,ownerId:loser.ownerId}))
  throw Error('B422_NON_OWNER_COMPLETION_ALLOWED');
 // Simulate an interrupted worker whose lease has expired.
 await clients[0].query(`UPDATE operations_onboarding.nonce_cleanup_jobs
  SET lease_until=now()-interval '1 second' WHERE invitation_id=$1`,[invitationId]);
 const recovered=await loser.jobs.claim({ownerId:loser.ownerId});
 if(recovered.length!==1||recovered[0].invitationId!==invitationId)
  throw Error('B423_EXPIRED_LEASE_NOT_RECLAIMED');
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
 if(!await loser.jobs.complete({invitationId,tenantId,ownerId:loser.ownerId}))
  throw Error('B423_RECOVERY_OWNER_COMPLETION_FAILED');
 if((await admin.pending()).length!==0)throw Error('B422_COMPLETED_JOB_PENDING');
 console.log('PASS: B422/B423 two-session job claiming, expired lease recovery, stale-owner denial');
}finally{
 for(const client of clients)await client.end();
}
