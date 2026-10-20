// B417 fixture-only durable nonce cleanup job repository.
// PostgreSQL persistence does not imply a deployed worker or distributed custody.
export function createPgNonceCleanupJobs(query){
 if(typeof query!=='function')throw Error('NONCE_JOB_DATABASE_REQUIRED');
 return Object.freeze({
  async enqueue({invitationId,tenantId}){
   if(!invitationId||!tenantId)throw Error('INVALID_NONCE_JOB');
   const result=await query(`INSERT INTO operations_onboarding.nonce_cleanup_jobs
    (invitation_id,tenant_id) VALUES($1,$2)
    ON CONFLICT(invitation_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id
    WHERE operations_onboarding.nonce_cleanup_jobs.tenant_id=EXCLUDED.tenant_id
    RETURNING invitation_id`,[invitationId,tenantId]);
   if(result.rowCount!==1)throw Error('NONCE_JOB_TENANT_CONFLICT');
  },
  async pending({limit=25}={}){
   if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_NONCE_JOB_LIMIT');
   const result=await query(`SELECT invitation_id,tenant_id FROM operations_onboarding.nonce_cleanup_jobs
    WHERE state='PENDING' ORDER BY created_at,invitation_id LIMIT $1`,[limit]);
   return result.rows.map(row=>({invitationId:row.invitation_id,tenantId:row.tenant_id}));
  },
  async complete({invitationId,tenantId}){
   const result=await query(`UPDATE operations_onboarding.nonce_cleanup_jobs
    SET state='COMPLETE',completed_at=now(),attempts=attempts+1,last_attempt_at=now()
    WHERE invitation_id=$1 AND tenant_id=$2 AND state='PENDING'
    RETURNING invitation_id`,[invitationId,tenantId]);
   return result.rowCount===1;
  }
 });
}
