// B401 isolated HTTP -> verified proof -> PostgreSQL provisioning.
// Test-only fixture: no live identity provider, no production HTTP wiring.
import {Client} from 'pg';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createHostedOidcVerifier} from '../server/operations-hosted-oidc.experimental.mjs';
import {once} from 'node:events';
import {createPgNonceChallenges} from '../server/operations-pg-nonce-challenges.experimental.mjs';
import {createPgProvisioner} from '../server/operations-pg-provisioning.experimental.mjs';
import {createVerifiedProvisioningFlow} from '../server/operations-pg-verified-provisioning.experimental.mjs';
import {createIsolatedOnboardingHttpServer} from '../server/operations-onboarding-http.experimental.mjs';
import {createPgInvitationContextResolver} from '../server/operations-pg-invitation-context.experimental.mjs';
import {createAuthenticatedChallengeCustody} from '../server/operations-authenticated-challenge.experimental.mjs';
import {createEphemeralNonceStore} from '../server/operations-ephemeral-nonce-store.experimental.mjs';
import {createNonceCleanupReconciler} from '../server/operations-nonce-cleanup-reconciler.experimental.mjs';
import {createPgActivationLookup} from '../server/operations-pg-activation-lookup.experimental.mjs';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
import {createNonceCleanupWorker} from '../server/operations-nonce-cleanup-worker.experimental.mjs';
import {createTrustedNonceResolver} from '../server/operations-pg-trusted-nonce.experimental.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const invitationId='a1010101-0101-4101-8101-010101010101';
const tenantId='a2020202-0202-4202-8202-020202020202';
const actorId='a3030303-0303-4303-8303-030303030303';
const issuer='https://identity.fixture.invalid',subject='b401-subject';
const nonce='b401-server-challenge';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'b401-test-key',alg:'RS256',use:'sig'};
const now=Math.floor(Date.now()/1000);
const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:jwk.kid})).toString('base64url');
const payload=Buffer.from(JSON.stringify({iss:issuer,aud:'iway-fixture',sub:subject,iat:now-10,exp:now+300,nonce,amr:['mfa']})).toString('base64url');
const signClaims=claims=>{
 const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return header+'.'+encoded+'.'+sign('RSA-SHA256',Buffer.from(header+'.'+encoded),privateKey).toString('base64url');
};
const claims={iss:issuer,aud:'iway-fixture',sub:subject,iat:now-10,exp:now+300,nonce,amr:['mfa']};
const token=signClaims(claims);
const client=new Client();
await client.connect();
const transaction=async fn=>{
 await client.query('BEGIN');
 try{const result=await fn(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}
};
let server;
try{
 await client.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,'b401@example.invalid','{"role":"driver"}',$4,$5,'VERIFIED',now()+interval '1 hour')`,
 [invitationId,tenantId,actorId,issuer,digest(subject)]);
 await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
 (nonce_hash,invitation_id,tenant_id,expires_at)
 VALUES($1,$2,$3,now()+interval '5 minutes')`,[digest(nonce),invitationId,tenantId]);
 const nonceRepo=createPgNonceChallenges(transaction);
 // Duplicate issuance must fail while the original challenge is outstanding.
 try{await nonceRepo.issue({invitationId,tenantId});throw Error('B409_DUPLICATE_NONCE_ALLOWED');}
 catch(error){if(error.message==='B409_DUPLICATE_NONCE_ALLOWED')throw error;}
 const provisioner=createPgProvisioner(transaction,{consumeNonce:nonceRepo.consume});
 const verifiedProvisioning=createVerifiedProvisioningFlow({
  provisioner,expectedAudience:'iway-fixture',allowedIssuers:new Set([issuer]),
  verifyIdentity:createHostedOidcVerifier({issuer,audience:'iway-fixture',jwks:{keys:[jwk]},enabled:true})
 });
 const nonceStore=createEphemeralNonceStore({authorizeFence:scope=>
  createPgNonceCleanupJobs((sql,params)=>client.query(sql,params)).ownsFence(scope)});
 await nonceStore.storeNonce({invitationId,tenantId,nonce});
 const trustedNonce=createTrustedNonceResolver({
  readServerNonce:nonceStore.readNonce,
  lookupChallenge:async({invitationId:requested,tenantId:requestedTenant,nonceHash})=>{
   const r=await client.query(`SELECT nonce_hash FROM operations_onboarding.identity_nonce_challenges WHERE invitation_id=$1 AND tenant_id=$2 AND nonce_hash=$3 AND consumed_at IS NULL AND expires_at>now()`,[requested,requestedTenant,nonceHash]);
   return r.rowCount===1?{active:true,invitationId:requested,tenantId:requestedTenant,nonceHash:r.rows[0].nonce_hash}:null;
  }
 });
 const resolveInvitationContext=createPgInvitationContextResolver({
  query:(sql,params)=>client.query(sql,params),
  resolveNonce:trustedNonce
 });
 const custody=createAuthenticatedChallengeCustody({
  issueNonce:async()=>nonce,
  resolveInvitation:async requested=>{
   const r=await client.query('SELECT id,tenant_id,issuer,subject_hash,state,expires_at FROM operations_onboarding.invitations WHERE id=$1',[requested]);
   const row=r.rows[0];return row?{id:row.id,tenantId:row.tenant_id,issuer:row.issuer,subjectHash:row.subject_hash,state:row.state,expiresAt:row.expires_at}:null;
  },
  storeNonce:async()=>{},
  readNonce:nonceStore.readNonce,
  verifySession:async token=>token==='fixture-session'?{verified:true,issuer,subjectHash:digest(subject),subject}:null
 });
 server=createIsolatedOnboardingHttpServer({verifiedProvisioning,resolveInvitationContext,challengeCustody:custody,clearNonce:nonceStore.clearNonce});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port+'/experimental/onboarding/provision';
 const body={invitationId,tenantId,actorId,role:'driver',token,expectedNonce:nonce};
 const post=async data=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 const challengeUrl=url.replace('/provision','/challenge');
 const challengePost=authorization=>fetch(challengeUrl,{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify({invitationId})});
 if((await challengePost()).status!==403)throw Error('B407_ANONYMOUS_CHALLENGE_ALLOWED');
 if((await challengePost('Bearer invalid')).status!==403)throw Error('B407_INVALID_SESSION_CHALLENGE_ALLOWED');
 const challengeResponse=await challengePost('Bearer fixture-session');
 if(challengeResponse.status!==200||(await challengeResponse.json()).nonce!==nonce)throw Error('B407_CHALLENGE_ISSUANCE_FAILED');
 const expired=await post({...body,token:signClaims({...claims,exp:now-1})});
 if(expired.status!==403)throw Error('B402_EXPIRED_TOKEN_ALLOWED');
 const wrongAudience=await post({...body,token:signClaims({...claims,aud:'untrusted-client'})});
 if(wrongAudience.status!==403)throw Error('B402_WRONG_AUDIENCE_ALLOWED');
 const elevatedRole=await post({...body,role:'platform'});
 if(elevatedRole.status!==200)throw Error('B403_CLIENT_ROLE_OVERRIDE_CHANGED_TRUSTED_ROLE');
 const success=elevatedRole;
 if((await success.json()).state!=='ACTIVE')throw Error('B401_HTTP_ACTIVATION_FAILED');
 if(await nonceStore.readNonce({invitationId,tenantId})!==null)throw Error('B413_NONCE_CUSTODY_NOT_CLEARED');
 const durableJob=await client.query(`SELECT state,tenant_id FROM operations_onboarding.nonce_cleanup_jobs WHERE invitation_id=$1`,[invitationId]);
 if(durableJob.rowCount!==1||durableJob.rows[0].state!=='PENDING'||durableJob.rows[0].tenant_id!==tenantId)
  throw Error('B418_ACTIVATION_DID_NOT_COMMIT_CLEANUP_JOB');
 // Simulate a post-commit orphaned raw nonce after a custody outage,
 // then reconcile using the actual persisted ACTIVE invitation and role binding.
 await nonceStore.storeNonce({invitationId,tenantId,nonce});
 let cleanupAttempts=0;
 const reconciler=createNonceCleanupReconciler({
  lookupActivation:createPgActivationLookup((sql,params)=>client.query(sql,params)),
  clearNonce:async scope=>{
   if(++cleanupAttempts===1)throw Error('B416_SIMULATED_CUSTODY_OUTAGE');
   await nonceStore.setFence(scope);
   await nonceStore.clearNonceFenced(scope);
  }
 });
 try{await reconciler.reconcile({invitationId,tenantId});throw Error('B416_OUTAGE_NOT_PROPAGATED');}
 catch(error){if(error.message!=='B416_SIMULATED_CUSTODY_OUTAGE')throw error;}
 if(await nonceStore.readNonce({invitationId,tenantId})!==nonce)throw Error('B416_OUTAGE_DID_NOT_PRESERVE_RETRY');
 // Simulate a worker crash/restart: first pass sees cleanup outage and
 // leaves the durable job pending; a new worker instance completes it.
 const jobs=createPgNonceCleanupJobs((sql,params)=>client.query(sql,params));
 const worker=createNonceCleanupWorker({jobs,reconciler,finalizeDatabase:true});
 const recovered=await worker.runOnce({limit:10});
 if(recovered.completed!==1||recovered.failed!==0)throw Error('B420_WORKER_RESTART_RECOVERY_FAILED');
 if(await nonceStore.readNonce({invitationId,tenantId})!==null)
  throw Error('B420_NONCE_NOT_CLEARED');
 const finished=await client.query('SELECT state FROM operations_onboarding.nonce_cleanup_jobs WHERE invitation_id=$1',[invitationId]);
 if(finished.rows[0]?.state!=='COMPLETE')throw Error('B420_JOB_NOT_COMPLETED');
 // B430: use a second durable cleanup job for the already ACTIVE invitation
 // and assert atomic consumed-challenge deletion plus completion.
 await client.query(`UPDATE operations_onboarding.nonce_cleanup_jobs
  SET state='PENDING',lease_owner=NULL,lease_until=NULL,completed_at=NULL
  WHERE invitation_id=$1`,[invitationId]);
 const consumed=await client.query(`SELECT count(*)::int AS n
  FROM operations_onboarding.identity_nonce_challenges
  WHERE invitation_id=$1 AND consumed_at IS NOT NULL`,[invitationId]);
 if(consumed.rows[0].n<1)throw Error('B430_MISSING_CONSUMED_CHALLENGE_FIXTURE');
 const b430Owner=randomUUID();
 const b430Claim=await jobs.claim({ownerId:b430Owner,limit:10});
 if(b430Claim.length!==1)throw Error('B430_CLAIM_FAILED');
 if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:randomUUID(),fenceToken:b430Claim[0].fenceToken}))
  throw Error('B430_NON_OWNER_FINALIZED');
 if(await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:b430Owner,fenceToken:b430Claim[0].fenceToken-1}))
  throw Error('B430_STALE_FENCE_FINALIZED');
 if(!await jobs.finalizeConsumedChallenges({invitationId,tenantId,ownerId:b430Owner,fenceToken:b430Claim[0].fenceToken}))
  throw Error('B430_ATOMIC_FINALIZATION_FAILED');
 const b430State=await client.query(`SELECT
  (SELECT count(*)::int FROM operations_onboarding.identity_nonce_challenges WHERE invitation_id=$1 AND consumed_at IS NOT NULL) AS remaining,
  (SELECT state FROM operations_onboarding.nonce_cleanup_jobs WHERE invitation_id=$1) AS job_state`,[invitationId]);
 if(b430State.rows[0].remaining!==0||b430State.rows[0].job_state!=='COMPLETE')
  throw Error('B430_ATOMIC_CLEANUP_INVARIANT_FAILED');
 const rerun=await createNonceCleanupWorker({jobs,reconciler}).runOnce({limit:10});
 if(rerun.scanned!==0)throw Error('B420_COMPLETED_JOB_REPROCESSED');
 const postCommitReplay=await post(body);
 if(postCommitReplay.status!==403)throw Error('B414_POST_COMMIT_REPLAY_ALLOWED');
 const forged=await post({...body,token:token.slice(0,-2)+'xx'});
 if(forged.status!==403)throw Error('B402_FORGED_SIGNATURE_ALLOWED');
 const wrongNonce=await post({...body,expectedNonce:'attacker-nonce'});
 if(wrongNonce.status!==403)throw Error('B402_NONCE_MISMATCH_ALLOWED');
 const replay=await post(body);
 if(replay.status!==403)throw Error('B401_REPLAY_ALLOWED');
 const otherTenant=await post({...body,invitationId:'a4040404-0404-4404-8404-040404040404'});
 if(otherTenant.status!==403)throw Error('B401_CROSS_TENANT_ALLOWED');
 const state=await client.query('SELECT state FROM operations_onboarding.invitations WHERE id=$1',[invitationId]);
 const bindings=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.tenant_role_bindings WHERE invitation_id=$1',[invitationId]);
 if(state.rows[0]?.state!=='ACTIVE'||bindings.rows[0].n!==1)throw Error('B401_DB_STATE_INVALID');
 console.log('PASS: isolated HTTP verified provisioning to PostgreSQL, replay and cross-tenant denial');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await client.end();
}
