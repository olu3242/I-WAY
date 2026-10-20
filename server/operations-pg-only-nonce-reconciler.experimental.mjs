// B435: PostgreSQL-only recovery reconciler. No in-memory/raw nonce deletion.
// Consumed nonce hashes and job completion are finalized together by
// jobs.finalizeConsumedChallenges() after this readiness check.
export function createPostgresOnlyNonceReconciler({activationLookup}={}){
 if(!activationLookup||typeof activationLookup!=='function')
  throw Error('POSTGRES_ACTIVATION_LOOKUP_REQUIRED');
 return Object.freeze({
  async reconcile({invitationId,tenantId}={}){
   if(!invitationId||!tenantId)throw Error('INVALID_NONCE_RECOVERY_SCOPE');
   const activation=await activationLookup({invitationId,tenantId});
   return {reconciled:activation?.state==='ACTIVE'&&activation?.bindingCount===1};
  }
 });
}
