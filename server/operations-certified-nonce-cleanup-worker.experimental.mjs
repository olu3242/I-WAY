// B433 strict certification boundary: do not allow legacy/unfenced job completion.
// Only the PostgreSQL atomic finalizer may mark a cleanup job COMPLETE.
// External custody must be independently proven durable and fenced before release.
import {createNonceCleanupWorker} from './operations-nonce-cleanup-worker.experimental.mjs';
export function createCertifiedNonceCleanupWorker({jobs,reconciler,logger}={}){
 if(!jobs||typeof jobs.claim!=='function'||typeof jobs.ownsFence!=='function'
  ||typeof jobs.finalizeConsumedChallenges!=='function'
  ||!reconciler||typeof reconciler.reconcile!=='function')
  throw Error('CERTIFIED_NONCE_WORKER_DEPENDENCIES_REQUIRED');
 const guardedReconciler=Object.freeze({
  async reconcile(scope){
   if(!Number.isSafeInteger(scope.fenceToken)||scope.fenceToken<1
    ||!await jobs.ownsFence(scope))
    return {reconciled:false,reason:'FENCE_NOT_OWNED'};
   return reconciler.reconcile(scope);
  }
 });
 return createNonceCleanupWorker({jobs,reconciler:guardedReconciler,logger,finalizeDatabase:true});
}
