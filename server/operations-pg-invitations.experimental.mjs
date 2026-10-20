// B392 experimental PostgreSQL invitation persistence contract.
// Not wired to the hosted runtime. Caller must supply an independently
// verified restricted transaction client; no privileged fallback is allowed.
import {randomUUID} from 'node:crypto';
const states=new Set(['CREATED','SENT','OPENED','VERIFIED','ACCEPTED','ACTIVE','EXPIRED','REVOKED','REJECTED','FAILED']);
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function createPgInvitationRepository(transaction){
 if(typeof transaction!=='function')throw Error('RESTRICTED_TRANSACTION_REQUIRED');
 return Object.freeze({
  async create(input){
   if(!input||!hex64(input.subjectHash)||!hex64(input.tokenHash)||!input.tenantId||!input.creatorId||!input.issuer||!input.recipient||!input.assignment||!input.expiresAt)throw Error('INVALID_INVITATION');
   const id=randomUUID();
   return transaction(async client=>{
    const r=await client.query(`INSERT INTO operations_onboarding.invitations
     (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,token_hash,state,expires_at)
     VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,'CREATED',$9) RETURNING id,state`,
     [id,input.tenantId,input.creatorId,input.recipient,JSON.stringify(input.assignment),input.issuer,input.subjectHash,input.tokenHash,input.expiresAt]);
    await client.query('INSERT INTO operations_onboarding.invitation_events(invitation_id,actor_id,event_type) VALUES($1,$2,$3)',[id,input.creatorId,'CREATED']);
    return r.rows[0];
   });
  },
  async recordTransition({id,tenantId,actorId,from,to}){
   if(!states.has(from)||!states.has(to)||!id||!tenantId||!actorId)throw Error('INVALID_TRANSITION');
   return transaction(async client=>{
    const r=await client.query(`UPDATE operations_onboarding.invitations SET state=$4
      WHERE id=$1 AND tenant_id=$2 AND state=$3 AND expires_at>now()
      RETURNING id,state`,[id,tenantId,from,to]);
    if(r.rowCount!==1)throw Error('TRANSITION_REJECTED');
    await client.query('INSERT INTO operations_onboarding.invitation_events(invitation_id,actor_id,event_type) VALUES($1,$2,$3)',[id,actorId,to]);
    return r.rows[0];
   });
  }
 });
}
// Activation and recipient-proof acceptance are intentionally NOT exposed.
// They require approved identity verification, user provisioning, and
// atomic account/binding/session writes within the same restricted transaction.
