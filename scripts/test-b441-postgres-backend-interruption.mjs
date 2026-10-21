// B441 real PostgreSQL connection interruption, disposable fixture only.
// Terminates the backend of a leased worker connection and verifies recovery
// on a separate connection. No database service restart or hosted failover.
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID();
const oldOwner=randomUUID(),newOwner=randomUUID();
const admin=new Client(),worker=new Client(),recovered=new Client();
await admin.connect();await worker.connect();await recovered.connect();
// Expected asynchronous error after pg_terminate_backend; otherwise Node
// emits an unhandled EventEmitter 'error' before the recovery assertions.
let workerConnectionError=null;
worker.on('error',error=>{workerConnectionError=error;});
try{
 await admin.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'VERIFIED',now()+interval '1 hour')`,
 [invitationId,tenantId,actorId,invitationId+'@example.invalid','c'.repeat(64)]);
 const adminJobs=createPgNonceCleanupJobs((sql,params)=>admin.query(sql,params));
 await adminJobs.enqueue({invitationId,tenantId});
 const oldJobs=createPgNonceCleanupJobs((sql,params)=>worker.query(sql,params));
 const oldClaim=await oldJobs.claim({ownerId:oldOwner,leaseSeconds:30});
 if(oldClaim.length!==1)throw Error('B441_INITIAL_CLAIM_FAILED');
 const backend=await worker.query('SELECT pg_backend_pid() AS pid');
 const killed=await admin.query('SELECT pg_terminate_backend($1) AS terminated',[backend.rows[0].pid]);
 if(killed.rows[0]?.terminated!==true)throw Error('B441_DATABASE_BACKEND_NOT_TERMINATED');
 let interrupted=false;
 try{await oldJobs.ownsFence({invitationId,tenantId,ownerId:oldOwner,fenceToken:oldClaim[0].fenceToken});}
 catch{interrupted=true;}
 if(!interrupted&&!workerConnectionError)throw Error('B441_DISCONNECTED_WORKER_STILL_QUERIED_DATABASE');
 const recoveryJobs=createPgNonceCleanupJobs((sql,params)=>recovered.query(sql,params));
 if((await recoveryJobs.claim({ownerId:newOwner})).length!==0)
  throw Error('B441_PREMATURE_TAKEOVER');
 await admin.query(`UPDATE operations_onboarding.nonce_cleanup_jobs
 SET lease_until=now()-interval '1 second' WHERE invitation_id=$1`,[invitationId]);
 const replacement=await recoveryJobs.claim({ownerId:newOwner});
 if(replacement.length!==1||replacement[0].fenceToken<=oldClaim[0].fenceToken)
  throw Error('B441_RECOVERY_FENCE_NOT_ADVANCED');
 if(await recoveryJobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:oldOwner,fenceToken:oldClaim[0].fenceToken}))
  throw Error('B441_STALE_OWNER_FINALIZED');
 if(!await recoveryJobs.ownsFence({invitationId,tenantId,ownerId:newOwner,fenceToken:replacement[0].fenceToken}))
  throw Error('B441_NEW_CONNECTION_NOT_AUTHORIZED');
 if(!await recoveryJobs.complete({invitationId,tenantId,ownerId:newOwner}))
  throw Error('B441_FIXTURE_CLEANUP_FAILED');
 console.log('PASS: B441 terminated PostgreSQL backend, retained lease, recovered with fresh connection and fencing');
}finally{
 await Promise.allSettled([admin.end(),worker.end(),recovered.end()]);
}
