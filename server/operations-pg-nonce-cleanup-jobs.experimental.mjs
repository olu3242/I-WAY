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
  async claim({ownerId,limit=25,leaseSeconds=60}={}){
   if(typeof ownerId!=='string'||!/^[0-9a-f-]{36}$/i.test(ownerId)
    ||!Number.isInteger(limit)||limit<1||limit>100
    ||!Number.isInteger(leaseSeconds)||leaseSeconds<5||leaseSeconds>600)
    throw Error('INVALID_NONCE_JOB_CLAIM');
   const result=await query(`WITH eligible AS (
    SELECT invitation_id FROM operations_onboarding.nonce_cleanup_jobs
    WHERE state='PENDING' AND (lease_until IS NULL OR lease_until<now())
    ORDER BY created_at,invitation_id FOR UPDATE SKIP LOCKED LIMIT $1
   )
   UPDATE operations_onboarding.nonce_cleanup_jobs j
    SET lease_owner=$2::uuid,lease_until=now()+($3::int * interval '1 second'),
    fence_token=j.fence_token+1
   FROM eligible WHERE j.invitation_id=eligible.invitation_id
   RETURNING j.invitation_id,j.tenant_id,j.fence_token`,[limit,ownerId,leaseSeconds]);
   return result.rows.map(row=>({invitationId:row.invitation_id,tenantId:row.tenant_id,fenceToken:Number(row.fence_token)}));
  },
  async ownsFence({invitationId,tenantId,ownerId,fenceToken}){
   if(!invitationId||!tenantId||typeof ownerId!=='string'||!/^[0-9a-f-]{36}$/i.test(ownerId)
    ||!Number.isSafeInteger(fenceToken)||fenceToken<1)return false;
   const result=await query(`SELECT 1 FROM operations_onboarding.nonce_cleanup_jobs
    WHERE invitation_id=$1 AND tenant_id=$2 AND state='PENDING'
    AND lease_owner=$3::uuid AND fence_token=$4::bigint AND lease_until>now()`,
    [invitationId,tenantId,ownerId,fenceToken]);
   return result.rowCount===1;
  },
  async ownsLease({invitationId,tenantId,ownerId}){
   if(!invitationId||!tenantId||typeof ownerId!=='string'||!/^[0-9a-f-]{36}$/i.test(ownerId))
    return false;
   const result=await query(`SELECT 1 FROM operations_onboarding.nonce_cleanup_jobs
    WHERE invitation_id=$1 AND tenant_id=$2 AND state='PENDING'
    AND lease_owner=$3::uuid AND lease_until>now()`,[invitationId,tenantId,ownerId]);
   return result.rowCount===1;
  },
  async renewLease({invitationId,tenantId,ownerId,leaseSeconds=60}={}){
   if(!invitationId||!tenantId||typeof ownerId!=='string'||!/^[0-9a-f-]{36}$/i.test(ownerId)
    ||!Number.isInteger(leaseSeconds)||leaseSeconds<5||leaseSeconds>600)
    throw Error('INVALID_NONCE_LEASE_RENEWAL');
   const result=await query(`UPDATE operations_onboarding.nonce_cleanup_jobs
    SET lease_until=now()+($4::int * interval '1 second')
    WHERE invitation_id=$1 AND tenant_id=$2 AND state='PENDING'
    AND lease_owner=$3::uuid AND lease_until>now()
    RETURNING invitation_id`,[invitationId,tenantId,ownerId,leaseSeconds]);
   return result.rowCount===1;
  },
  // Atomic PostgreSQL-only cleanup: remove consumed challenge hashes and
  // complete the leased job in one statement. This does NOT clear raw
  // nonce custody in an external/in-memory store.
  async finalizeConsumedChallenges({invitationId,tenantId,ownerId,fenceToken}={}){
   if(!invitationId||!tenantId||typeof ownerId!=='string'
    ||!/^[0-9a-f-]{36}$/i.test(ownerId)
    ||!Number.isSafeInteger(fenceToken)||fenceToken<1)
    throw Error('INVALID_NONCE_FINALIZATION');
   const result=await query(`WITH eligible AS MATERIALIZED (
     SELECT j.invitation_id,j.tenant_id
     FROM operations_onboarding.nonce_cleanup_jobs j
     JOIN operations_onboarding.invitations i
      ON i.id=j.invitation_id AND i.tenant_id=j.tenant_id
     WHERE j.invitation_id=$1 AND j.tenant_id=$2
      AND j.lease_owner=$3::uuid AND j.fence_token=$4::bigint
      AND j.lease_until>now() AND j.state='PENDING' AND i.state='ACTIVE'
      AND (SELECT count(*) FROM operations_onboarding.tenant_role_bindings b
       WHERE b.invitation_id=j.invitation_id AND b.tenant_id=j.tenant_id)=1
     FOR UPDATE OF j
    ), removed AS (
     DELETE FROM operations_onboarding.identity_nonce_challenges n
     USING eligible e
     WHERE n.invitation_id=e.invitation_id AND n.tenant_id=e.tenant_id
      AND n.consumed_at IS NOT NULL
     RETURNING n.nonce_hash
    )
    UPDATE operations_onboarding.nonce_cleanup_jobs j
    SET state='COMPLETE',completed_at=now(),last_attempt_at=now(),
     attempts=attempts+1
    FROM eligible e
    WHERE j.invitation_id=e.invitation_id
     AND (SELECT count(*) FROM removed)>=0
    RETURNING j.invitation_id`,[invitationId,tenantId,ownerId,fenceToken]);
   return result.rowCount===1;
  },
  async complete({invitationId,tenantId,ownerId}){
   if(!ownerId)throw Error('NONCE_JOB_OWNER_REQUIRED');
   const result=await query(`UPDATE operations_onboarding.nonce_cleanup_jobs
    SET state='COMPLETE',completed_at=now(),attempts=attempts+1,last_attempt_at=now()
    WHERE invitation_id=$1 AND tenant_id=$2 AND state='PENDING'
    AND lease_owner=$3::uuid AND lease_until>now()
    RETURNING invitation_id`,[invitationId,tenantId,ownerId]);
   return result.rowCount===1;
  }
 });
}
