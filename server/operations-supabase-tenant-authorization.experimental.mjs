// B448: authorization guard for a verified Supabase user identity.
// Server-side only: resolve user with supabase.auth.getUser(accessToken),
// never trust an arbitrary client-supplied userId.
export function createSupabaseTenantAuthorization({getUser,roleStore}={}){
 if(typeof getUser!=='function'||typeof roleStore?.hasActiveRole!=='function')
  throw Error('SUPABASE_AUTHORIZATION_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  async authorize({accessToken,tenantId,role}={}){
   if(typeof accessToken!=='string'||accessToken.length===0)
    return {allowed:false,reason:'MISSING_SESSION'};
   let user;
   try{
    const response=await getUser(accessToken);
    if(response?.error||!response?.data?.user?.id)
     return {allowed:false,reason:'INVALID_SESSION'};
    user=response.data.user;
   }catch{return {allowed:false,reason:'IDENTITY_PROVIDER_UNAVAILABLE'};}
   try{
    const allowed=await roleStore.hasActiveRole({userId:user.id,tenantId,role});
    return allowed?{allowed:true,userId:user.id,tenantId,role}:{allowed:false,reason:'TENANT_ROLE_DENIED'};
   }catch{return {allowed:false,reason:'AUTHORIZATION_STORE_UNAVAILABLE'};}
  }
 });
}
