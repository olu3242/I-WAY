// Isolated B399 JavaScript -> real PostgreSQL transaction integration.
// Run ONLY against disposable CI PostgreSQL, never production.
import {Client} from 'pg';
import {createPgProvisioner} from '../server/operations-pg-provisioning.experimental.mjs';
import {createPgNonceChallenges} from '../server/operations-pg-nonce-challenges.experimental.mjs';
const id='92929292-9292-4929-8929-929292929292';
const tenant='93939393-9393-4939-8939-939393939393';
const actor='94949494-9494-4949-8949-949494949494';
const hash='a'.repeat(64),proof='b'.repeat(64),nonce='b399-fixture-nonce';
const crypto=await import('node:crypto');
const nonceHash=crypto.createHash('sha256').update(nonce).digest('hex');
const client=new Client();
await client.connect();
const transaction=async fn=>{
 await client.query('BEGIN');
 try{const result=await fn(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}
};
try{
 await client.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,'b399@example.invalid','{"role":"driver"}','fixture',$4,'VERIFIED',now()+interval '1 hour')`,[id,tenant,actor,hash]);
 await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
 (nonce_hash,invitation_id,tenant_id,expires_at)
 VALUES($1,$2,$3,now()+interval '5 minutes')`,[nonceHash,id,tenant]);
 const challenges=createPgNonceChallenges(transaction);
 const repo=createPgProvisioner(transaction,{consumeNonce:challenges.consume});
 const request={invitationId:id,tenantId:tenant,actorId:actor,issuer:'fixture',subjectHash:hash,role:'driver',proofHash:proof,nonce};
 const result=await repo.provision(request);
 if(result.state!=='ACTIVE')throw Error('B399_ACTIVATION_FAILED');
 const state=await client.query('SELECT state,user_id FROM operations_onboarding.invitations WHERE id=$1',[id]);
 if(state.rows[0]?.state!=='ACTIVE'||state.rows[0]?.user_id!==result.accountId)throw Error('B399_PERSISTENCE_MISMATCH');
 const binding=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.tenant_role_bindings WHERE invitation_id=$1 AND role=$2',[id,'driver']);
 if(binding.rows[0].n!==1)throw Error('B399_BINDING_MISSING');
 let rejected=false;
 try{await repo.provision(request);}catch{rejected=true;}
 if(!rejected)throw Error('B399_REPLAY_ALLOWED');
 const nonceRows=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.identity_nonce_challenges WHERE nonce_hash=$1 AND consumed_at IS NOT NULL',[nonceHash]);
 if(nonceRows.rows[0].n!==1)throw Error('B399_NONCE_NOT_CONSUMED');
 const events=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.invitation_events WHERE invitation_id=$1 AND event_type=$2',[id,'ACTIVE']);
 if(events.rows[0].n!==1)throw Error('B399_AUDIT_MISSING');
 const proofs=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.identity_proof_uses WHERE proof_hash=$1',[proof]);
 if(proofs.rows[0].n!==1)throw Error('B399_REPLAY_LEDGER_INVALID');
 console.log('PASS: real JS PostgreSQL provisioning, binding, activation, and replay rejection');
}finally{await client.end();}
