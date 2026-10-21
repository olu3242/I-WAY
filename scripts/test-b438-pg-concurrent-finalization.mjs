// B438: two PostgreSQL sessions race the same fenced atomic finalization.
// Uses an isolated disposable fixture only; never touches production access.
import {Client} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
const clients=[new Client(),new Client(),new Client()];
const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID();
for(const client of clients)await client.connect();
try{
 const admin=clients[0];
 await admin.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'VERIFIED',now()+interval '1 hour')`,
 [invitationId,tenantId,actorId,invitationId+'@example.invalid',createHash('sha256').update(invitationId).digest('hex')]);
 // Only a valid ACTIVE invitation with one role binding may be finalized.
 // Existing provisioning fixture provides the binding schema.
 const accountId=randomUUID();
 await admin.query(`INSERT INTO operations_onboarding.provisioned_accounts
 (id,issuer,subject_hash,created_at) VALUES($1,$2,$3,now())`,
 [accountId,'https://fixture.invalid',createHash('sha256').update('account-'+invitationId).digest('hex')]);
 await admin.query(`INSERT INTO operations_onboarding.tenant_role_bindings
 (tenant_id,account_id,invitation_id,role) VALUES($1,$2,$3,'driver')`,
 [tenantId,accountId,invitationId]);
 await admin.query(`UPDATE operations_onboarding.invitations SET state='ACTIVE' WHERE id=$1`,[invitationId]);
 await admin.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
 (nonce_hash,invitation_id,tenant_id,expires_at,consumed_at)
 VALUES($1,$2,$3,now()-interval '1 minute',now()-interval '1 second')`,
 [createHash('sha256').update('b438-'+invitationId).digest('hex'),invitationId,tenantId]);
 const jobs=createPgNonceCleanupJobs((sql,args)=>admin.query(sql,args));
 await jobs.enqueue({invitationId,tenantId});
 const ownerId=randomUUID();
 const claim=await jobs.claim({ownerId,limit:1});
 if(claim.length!==1)throw Error('B438_CLAIM_MISSING');
 const scope={invitationId,tenantId,ownerId,fenceToken:claim[0].fenceToken};
 const left=createPgNonceCleanupJobs((sql,args)=>clients[1].query(sql,args));
 const right=createPgNonceCleanupJobs((sql,args)=>clients[2].query(sql,args));
 const results=await Promise.all([left.finalizeConsumedChallenges(scope),right.finalizeConsumedChallenges(scope)]);
 if(results.filter(Boolean).length!==1)throw Error('B438_DOUBLE_FINALIZATION');
 if(await left.finalizeConsumedChallenges({...scope,fenceToken:scope.fenceToken-1}))
  throw Error('B438_STALE_FENCE_FINALIZED');
 const result=await admin.query(`SELECT
 (SELECT count(*)::int FROM operations_onboarding.identity_nonce_challenges WHERE invitation_id=$1) AS remaining,
 (SELECT state FROM operations_onboarding.nonce_cleanup_jobs WHERE invitation_id=$1) AS job_state`,[invitationId]);
 if(result.rows[0].remaining!==0||result.rows[0].job_state!=='COMPLETE')
  throw Error('B438_ATOMIC_FINALIZATION_INVARIANT_FAILED');
 console.log('PASS: B438 concurrent fenced PostgreSQL finalization is exactly once');
}finally{
 for(const client of clients)await client.end();
}
