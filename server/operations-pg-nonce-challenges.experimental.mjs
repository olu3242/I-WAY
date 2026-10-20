// Experimental nonce issuance and consumption. Never expose the transaction
// client to the browser; callers must provide a restricted transaction wrapper.
import {randomBytes,createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
export function createPgNonceChallenges(transaction){
 if(typeof transaction!=='function')throw Error('RESTRICTED_TRANSACTION_REQUIRED');
 return Object.freeze({
  async issue({invitationId,tenantId,ttlSeconds=300}){
   if(!invitationId||!tenantId||!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>600)
    throw Error('INVALID_NONCE_CHALLENGE');
   const nonce=randomBytes(32).toString('base64url');
   await transaction(async client=>{
    // Serialize issuance and fail closed if an unconsumed challenge exists.
    const invitation=await client.query(`SELECT id FROM operations_onboarding.invitations
     WHERE id=$1 AND tenant_id=$2 AND state='VERIFIED' AND expires_at>now()
     FOR UPDATE`,[invitationId,tenantId]);
    if(invitation.rowCount!==1)throw Error('NONCE_INVITATION_NOT_ELIGIBLE');
    const pending=await client.query(`SELECT nonce_hash FROM operations_onboarding.identity_nonce_challenges
     WHERE invitation_id=$1 AND consumed_at IS NULL LIMIT 1`,[invitationId]);
    if(pending.rowCount!==0)throw Error('NONCE_ALREADY_PENDING');
    await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
     (nonce_hash,invitation_id,tenant_id,expires_at)
     VALUES($1,$2,$3,now()+($4::integer * interval '1 second'))`,
     [digest(nonce),invitationId,tenantId,ttlSeconds]);
   });
   return nonce;
  },
  // Must be called within the same restricted transaction as provisioning.
  async consume(client,{nonce,invitationId,tenantId}){
   if(!client||typeof client.query!=='function'||!nonce||!invitationId||!tenantId)
    throw Error('INVALID_NONCE_CONSUMPTION');
   const r=await client.query(`UPDATE operations_onboarding.identity_nonce_challenges
    SET consumed_at=now() WHERE nonce_hash=$1 AND invitation_id=$2
    AND tenant_id=$3 AND consumed_at IS NULL AND expires_at>now()
    RETURNING nonce_hash`,[digest(nonce),invitationId,tenantId]);
   if(r.rowCount!==1)throw Error('NONCE_CONSUMPTION_REJECTED');
  }
 });
}
