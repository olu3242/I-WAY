// B444 bounded, secret-free cleanup telemetry for isolated workers.
// Never accept arbitrary error objects or identity tokens into log payloads.
const allowed=new Set(['NONCE_CLEANUP_RETRY_REQUIRED','NONCE_CLEANUP_COMPLETED','NONCE_CLEANUP_SKIPPED']);
export function createNonceCleanupTelemetry({emit}={}){
 if(typeof emit!=='function')throw Error('NONCE_TELEMETRY_EMITTER_REQUIRED');
 const counts={completed:0,skipped:0,failed:0};
 return Object.freeze({
  record({event}={}){
   if(!allowed.has(event))throw Error('INVALID_NONCE_TELEMETRY_EVENT');
   const status=event==='NONCE_CLEANUP_COMPLETED'?'completed'
    :event==='NONCE_CLEANUP_SKIPPED'?'skipped':'failed';
   counts[status]++;
   emit(Object.freeze({component:'nonce_cleanup',event,status}));
  },
  snapshot(){return Object.freeze({...counts});}
 });
}
