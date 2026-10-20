// B415 experimental post-commit nonce reconciliation.
// The database is authoritative: only committed ACTIVE invitations are eligible
// for raw nonce custody cleanup. Never mutate account or role assignments here.
export function createNonceCleanupReconciler({lookupActivation,clearNonce}){
 if(typeof lookupActivation!=='function'||typeof clearNonce!=='function')
  throw Error('NONCE_RECONCILIATION_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async reconcile({invitationId,tenantId,ownerId,fenceToken}={}){
   if(!invitationId||!tenantId)throw Error('INVALID_RECONCILIATION_REQUEST');
   const state=await lookupActivation({invitationId,tenantId});
   if(!state||state.invitationId!==invitationId||state.tenantId!==tenantId
    ||state.state!=='ACTIVE'||state.bindingCount!==1)
    return {reconciled:false,reason:'NOT_ACTIVATED'};
   await clearNonce({invitationId,tenantId,ownerId,fenceToken});
   return {reconciled:true};
  }
 });
}
