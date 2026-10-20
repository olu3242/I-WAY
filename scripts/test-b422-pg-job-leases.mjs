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
 if(!await winner.jobs.complete({invitationId,tenantId,ownerId:winner.ownerId}))
  throw Error('B422_LEASE_OWNER_COMPLETION_FAILED');
 if((await admin.pending()).length!==0)throw Error('B422_COMPLETED_JOB_PENDING');
 console.log('PASS: B422 two-session job claiming and lease-owner completion');
}finally{
 for(const client of clients)await client.end();
}
