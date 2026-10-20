// B436 experimental PostgreSQL durable nonce custody.
// This deliberately stores ONLY SHA-256 nonce digests, never raw nonce values.
// A consumed nonce may be finalized with the fenced job in one PostgreSQL
// transaction via createPgNonceCleanupJobs.finalizeConsumedChallenges.
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
export function createPgNonceCustody(query){
 if(typeof query!=='function')throw Error('POSTGRES_NONCE_CUSTODY_REQUIRED');
 return Object.freeze({
  async verifyUnconsumed({invitationId,tenantId,nonce}={}){
   if(!invitationId||!tenantId||typeof nonce!=='string'||nonce.length<16)
    throw Error('INVALID_NONCE_CUSTODY_REQUEST');
   const result=await query(`SELECT 1 FROM operations_onboarding.identity_nonce_challenges
    WHERE invitation_id=$1 AND tenant_id=$2 AND nonce_hash=$3
    AND consumed_at IS NULL AND expires_at>now()`,[invitationId,tenantId,digest(nonce)]);
   return result.rowCount===1;
  },
  async consumedCount({invitationId,tenantId}={}){
   if(!invitationId||!tenantId)throw Error('INVALID_NONCE_CUSTODY_SCOPE');
   const result=await query(`SELECT count(*)::int AS total
    FROM operations_onboarding.identity_nonce_challenges
    WHERE invitation_id=$1 AND tenant_id=$2 AND consumed_at IS NOT NULL`,
    [invitationId,tenantId]);
   return Number(result.rows[0]?.total??0);
  }
 });
}
