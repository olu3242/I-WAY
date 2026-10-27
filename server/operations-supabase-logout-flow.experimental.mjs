// B464: server-side, fail-closed logout orchestration.
// The browser receives only a cleared cookie, never provider credentials.
export function createServerLogout({getSession,revokeSession,revokeProviderSession,clearCookie}={}){
 if(![getSession,revokeSession,revokeProviderSession,clearCookie].every(fn=>typeof fn==='function'))
  throw Error('LOGOUT_DEPENDENCIES_REQUIRED');
 return async function logout({sessionId}={}){
  if(typeof sessionId!=='string'||!sessionId)return {ok:false,error:'LOGOUT_REJECTED'};
  try{
   const session=await getSession(sessionId);
   // Local revocation is mandatory even if upstream revocation fails.
   const revoked=await revokeSession(sessionId);
   if(!revoked)return {ok:false,error:'LOGOUT_REJECTED'};
   if(session?.access_token){
    try{await revokeProviderSession(session.access_token);}catch{/* local session remains revoked */}
   }
   return {ok:true,setCookie:clearCookie()};
  }catch{return {ok:false,error:'LOGOUT_REJECTED'};}
 };
}
