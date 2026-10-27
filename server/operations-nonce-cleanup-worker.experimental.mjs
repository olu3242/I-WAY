import {randomUUID} from 'node:crypto';
// B419 experimental bounded cleanup worker. Invoke from a trusted isolated runner.
// Durable job state is authoritative; this does not schedule or deploy a worker.
export function createNonceCleanupWorker({jobs,reconciler,logger=()=>{},finalizeDatabase=false}){
 if(!jobs||typeof jobs.claim!=='function'||typeof jobs.complete!=='function'||typeof jobs.ownsLease!=='function'||typeof jobs.renewLease!=='function'
  ||!reconciler||typeof reconciler.reconcile!=='function'||typeof logger!=='function'
  ||(finalizeDatabase&&typeof jobs.finalizeConsumedChallenges!=='function'))
  throw Error('NONCE_WORKER_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async runOnce({limit=25,ownerId=randomUUID()}={}){
   if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_NONCE_WORKER_LIMIT');
   const batch=await jobs.claim({limit,ownerId});
   let completed=0,skipped=0,failed=0;
   for(const scope of batch){
    try{
     if(!await jobs.ownsLease({...scope,ownerId})){skipped++;continue;}
     if(!await jobs.renewLease({...scope,ownerId})){skipped++;continue;}
     const result=await reconciler.reconcile({...scope,ownerId});
     if(!result.reconciled){skipped++;continue;}
     const done=finalizeDatabase
      ?await jobs.finalizeConsumedChallenges({...scope,ownerId})
      :await jobs.complete({...scope,ownerId});
     if(done)completed++;
     else failed++;
    }catch(error){
     failed++;
     logger({event:'NONCE_CLEANUP_RETRY_REQUIRED',invitationId:scope.invitationId,
      errorCode:'CLEANUP_FAILED'});
    }
   }
   return {scanned:batch.length,completed,skipped,failed};
  }
 });
}
