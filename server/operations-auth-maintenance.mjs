// Awaited request-driven cleanup; no untracked background work in serverless runtime.
export function createAuthMaintenance({transactions,sessions,clock=Date.now,intervalMs=30000}){
 if(typeof transactions?.expire!=='function'||typeof sessions?.recoverStale!=='function'||
  !Number.isInteger(intervalMs)||intervalMs<1||intervalMs>60000)throw Error('AUTH_MAINTENANCE_INVALID');
 let lastSuccess=-Infinity,pending;
 return async function maintain(){
  if(pending)return pending;
  if(clock()-lastSuccess<intervalMs)return;
  pending=(async()=>{await transactions.expire();await sessions.recoverStale();lastSuccess=clock();})();
  try{await pending;}finally{pending=undefined;}
 };
}
