// B443: disposable PostgreSQL restart regression with stale-owner takeover.
// Seed is persisted before the database service is restarted. After restart,
// expire the old lease and require a new fencing generation for finalization.
import {Client} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
const phase=process.argv[2];
if(!['seed','recover'].includes(phase))throw Error('B443_INVALID_PHASE');
const client=new Client();
await client.connect();
try{
 const jobs=createPgNonceCleanupJobs((sql,params)=>client.query(sql,params));
 if(phase==='seed'){
  const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID(),accountId=randomUUID(),ownerId=randomUUID();
  await client.query(`INSERT INTO operations_onboarding.invitations
   (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at,user_id)
   VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'ACTIVE',now()+interval '1 hour',$6)`,
   [invitationId,tenantId,actorId,invitationId+'@example.invalid','a'.repeat(64),accountId]);
  await client.query(`INSERT INTO operations_onboarding.provisioned_accounts
   (id,issuer,subject_hash) VALUES($1,'https://fixture.invalid',$2)`,
   [accountId,createHash('sha256').update(accountId).digest('hex')]);
  await client.query(`INSERT INTO operations_onboarding.tenant_role_bindings
   (tenant_id,account_id,role,invitation_id) VALUES($1,$2,'driver',$3)`,
   [tenantId,accountId,invitationId]);
  await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
   (nonce_hash,invitation_id,tenant_id,expires_at,consumed_at)
   VALUES($1,$2,$3,now()+interval '5 minutes',now())`,
   [createHash('sha256').update(invitationId).digest('hex'),invitationId,tenantId]);
  await jobs.enqueue({invitationId,tenantId});
  const claim=await jobs.claim({ownerId});
  if(claim.length!==1)throw Error('B443_SEED_CLAIM_FAILED');
  console.log(JSON.stringify({invitationId,tenantId,ownerId,fenceToken:claim[0].fenceToken}));
 }else{
  const {invitationId,tenantId,ownerId,fenceToken}=JSON.parse(process.env.B443_FIXTURE_SCOPE||'{}');
  if(!invitationId||!tenantId||!ownerId||!Number.isSafeInteger(fenceToken))
   throw Error('B443_SCOPE_MISSING');
  const newOwner=randomUUID();
  if((await jobs.claim({ownerId:newOwner})).length!==0)
   throw Error('B443_PREMATURE_TAKEOVER');
  await client.query(`UPDATE operations_onboarding.nonce_cleanup_jobs
   SET lease_until=now()-interval '1 second' WHERE invitation_id=$1`,[invitationId]);
  const claim=await jobs.claim({ownerId:newOwner});
  if(claim.length!==1||claim[0].fenceToken<=fenceToken)
   throw Error('B443_FENCE_NOT_ADVANCED');
  if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId,fenceToken}))
   throw Error('B443_STALE_FINALIZATION_ALLOWED');
  if(!await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:newOwner,fenceToken:claim[0].fenceToken}))
   throw Error('B443_NEW_OWNER_FINALIZATION_FAILED');
  const state=await client.query(`SELECT j.state,
   (SELECT count(*)::int FROM operations_onboarding.identity_nonce_challenges n
    WHERE n.invitation_id=j.invitation_id AND n.consumed_at IS NOT NULL) AS remaining
   FROM operations_onboarding.nonce_cleanup_jobs j WHERE j.invitation_id=$1`,[invitationId]);
  if(state.rows[0]?.state!=='COMPLETE'||state.rows[0]?.remaining!==0)
   throw Error('B443_ATOMIC_RECOVERY_INVARIANT_FAILED');
  console.log('PASS: B443 post-restart expired lease takeover, stale owner denial and atomic finalization');
 }
}finally{await client.end();}
