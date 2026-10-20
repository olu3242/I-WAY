// B442: run only after disposable PostgreSQL Docker service restart.
// Phase 1 seeds an active invitation, exactly one tenant binding, a consumed
// nonce hash, and a leased cleanup job. Phase 2 verifies restart durability
// and atomic finalization from a fresh client.
import {Client} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
const phase=process.argv[2];
if(!['seed','recover'].includes(phase))throw Error('B442_INVALID_PHASE');
const client=new Client();
await client.connect();
try{
 if(phase==='seed'){
  const invitationId=randomUUID(),tenantId=randomUUID(),actorId=randomUUID(),accountId=randomUUID(),ownerId=randomUUID();
  await client.query(`INSERT INTO operations_onboarding.invitations
   (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at,user_id)
   VALUES($1,$2,$3,$4,'{"role":"driver"}','https://fixture.invalid',$5,'ACTIVE',now()+interval '1 hour',$6)`,
   [invitationId,tenantId,actorId,invitationId+'@example.invalid','b'.repeat(64),accountId]);
  await client.query(`INSERT INTO operations_onboarding.provisioned_accounts
   (id,issuer,subject_hash) VALUES($1,'https://fixture.invalid',$2)`,[accountId,createHash('sha256').update(accountId).digest('hex')]);
  await client.query(`INSERT INTO operations_onboarding.tenant_role_bindings
   (tenant_id,account_id,role,invitation_id) VALUES($1,$2,'driver',$3)`,[tenantId,accountId,invitationId]);
  await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
   (nonce_hash,invitation_id,tenant_id,expires_at,consumed_at)
   VALUES($1,$2,$3,now()+interval '5 minutes',now())`,
   [createHash('sha256').update(invitationId).digest('hex'),invitationId,tenantId]);
  const jobs=createPgNonceCleanupJobs((sql,params)=>client.query(sql,params));
  await jobs.enqueue({invitationId,tenantId});
  const claimed=await jobs.claim({ownerId});
  if(claimed.length!==1)throw Error('B442_SEED_LEASE_MISSING');
  console.log(JSON.stringify({invitationId,tenantId,ownerId,fenceToken:claimed[0].fenceToken}));
 }else{
  const {invitationId,tenantId,ownerId,fenceToken}=JSON.parse(process.env.B442_FIXTURE_SCOPE||'{}');
  if(!invitationId||!tenantId||!ownerId||!Number.isSafeInteger(fenceToken))
   throw Error('B442_SCOPE_MISSING');
  const jobs=createPgNonceCleanupJobs((sql,params)=>client.query(sql,params));
  if(!await jobs.ownsFence({invitationId,tenantId,ownerId,fenceToken}))
   throw Error('B442_RESTART_DID_NOT_PRESERVE_LEASE');
  if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:randomUUID(),fenceToken}))
   throw Error('B442_NON_OWNER_FINALIZED');
  if(!await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId,fenceToken}))
   throw Error('B442_POST_RESTART_FINALIZATION_FAILED');
  const result=await client.query(`SELECT j.state,
   (SELECT count(*)::int FROM operations_onboarding.identity_nonce_challenges n
    WHERE n.invitation_id=j.invitation_id AND n.consumed_at IS NOT NULL) AS remaining
   FROM operations_onboarding.nonce_cleanup_jobs j WHERE j.invitation_id=$1`,[invitationId]);
  if(result.rows[0]?.state!=='COMPLETE'||result.rows[0]?.remaining!==0)
   throw Error('B442_ATOMIC_CLEANUP_NOT_DURABLE');
  if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId,fenceToken}))
   throw Error('B442_DUPLICATE_FINALIZATION');
  console.log('PASS: B442 actual PostgreSQL service restart preserved fenced lease and atomic cleanup');
 }
}finally{await client.end();}
