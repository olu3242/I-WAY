// B395 experimental account provisioning; restricted transaction required.
// Only accepts a previously VERIFIED invitation, matched to verified identity.
// This is a fixture contract, not a live user/session provisioning integration.
import {randomUUID} from 'node:crypto';
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const roles=new Set(['carrier','fleet','driver','platform']);
export function createPgProvisioner(transaction){
 if(typeof transaction!=='function')throw Error('RESTRICTED_TRANSACTION_REQUIRED');
 return Object.freeze({
  async provision({invitationId,tenantId,actorId,issuer,subjectHash,role,proofHash}){
   if(!invitationId||!tenantId||!actorId||!issuer||!hex64(subjectHash)||!hex64(proofHash)||!roles.has(role))
    throw Error('INVALID_PROVISIONING_REQUEST');
   return transaction(async client=>{
    // Unique ledger key serializes concurrent proof reuse; rollback restores it.
    await client.query(`INSERT INTO operations_onboarding.identity_proof_uses
      (proof_hash,invitation_id,tenant_id) VALUES($1,$2,$3)`,
      [proofHash,invitationId,tenantId]);
    // The conditional update serializes competing acceptance attempts.
    const accepted=await client.query(`UPDATE operations_onboarding.invitations
      SET state='ACCEPTED' WHERE id=$1 AND tenant_id=$2
      AND issuer=$3 AND subject_hash=$4 AND state='VERIFIED'
      AND expires_at>now() AND assignment->>'role'=$5
      RETURNING id`,[invitationId,tenantId,issuer,subjectHash,role]);
    if(accepted.rowCount!==1)throw Error('PROVISIONING_REJECTED');
    const accountId=randomUUID();
    const account=await client.query(`INSERT INTO operations_onboarding.provisioned_accounts(id,issuer,subject_hash)
      VALUES($1,$2,$3) ON CONFLICT(issuer,subject_hash) DO UPDATE
      SET subject_hash=EXCLUDED.subject_hash RETURNING id`,[accountId,issuer,subjectHash]);
    const userId=account.rows[0].id;
    await client.query(`INSERT INTO operations_onboarding.tenant_role_bindings
      (tenant_id,account_id,role,invitation_id) VALUES($1,$2,$3,$4)`,
      [tenantId,userId,role,invitationId]);
    await client.query(`UPDATE operations_onboarding.invitations SET user_id=$2,state='ACTIVE'
      WHERE id=$1 AND state='ACCEPTED'`,[invitationId,userId]);
    await client.query('INSERT INTO operations_onboarding.invitation_events(invitation_id,actor_id,event_type) VALUES($1,$2,$3)',
      [invitationId,actorId,'ACTIVE']);
    return {invitationId,accountId:userId,tenantId,role,state:'ACTIVE'};
   });
  }
 });
}
