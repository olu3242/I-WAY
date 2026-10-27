// B465: authenticated session authorization bridge.
// Server-side session ID is never used as an authorization claim.
// Tenant and role must be resolved from trusted route configuration, not request body.
export function createSessionTenantAuthorizer({getSession,getUser,hasActiveRole}={}){
 if(![getSession,getUser,hasActiveRole].every(fn=>typeof fn==='function'))
  throw Error('SESSION_AUTH_DEPENDENCIES_REQUIRED');
 return async function authorize({sessionId,tenantId,role}={}){
  if(typeof sessionId!=='string'||!sessionId||typeof tenantId!=='string'||!tenantId||
   typeof role!=='string'||!role)return {ok:false,error:'ACCESS_DENIED'};
  try{
   const session=await getSession(sessionId);
   if(!session?.access_token||!session?.user_id)return {ok:false,error:'ACCESS_DENIED'};
   const user=await getUser(session.access_token);
   if(!user?.id||user.id!==session.user_id)return {ok:false,error:'ACCESS_DENIED'};
   const allowed=await hasActiveRole({userId:user.id,tenantId,role});
   if(allowed!==true)return {ok:false,error:'ACCESS_DENIED'};
   return {ok:true,userId:user.id};
  }catch{return {ok:false,error:'ACCESS_DENIED'};}
 };
}
