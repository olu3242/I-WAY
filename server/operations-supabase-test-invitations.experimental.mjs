// B446: dependency-injected Supabase Auth invitation adapter.
// Only call from a trusted server after explicit user approval. Never store
// passwords or place service-role credentials in a browser.
export function createSupabaseTestInvitationProvisioner({authAdmin,roleStore,allowedRedirects=[]}={}){
 if(typeof authAdmin?.inviteUserByEmail!=='function'||typeof roleStore?.grant!=='function')
  throw Error('SUPABASE_PROVISIONING_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  async invite({email,tenantId,role,redirectTo,approved=false}={}){
   if(approved!==true)throw Error('TEST_INVITATION_APPROVAL_REQUIRED');
   if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)
    ||typeof tenantId!=='string'||!/^[0-9a-f-]{36}$/i.test(tenantId)
    ||!['carrier','fleet','platform','driver'].includes(role)
    ||!allowedRedirects.includes(redirectTo))
    throw Error('INVALID_TEST_INVITATION_SCOPE');
   const {data,error}=await authAdmin.inviteUserByEmail(email,{redirectTo});
   if(error)throw Error('SUPABASE_INVITATION_FAILED');
   if(!data?.user?.id)throw Error('SUPABASE_INVITED_USER_MISSING');
   try{
    await roleStore.grant({userId:data.user.id,tenantId,role});
   }catch{
    // Do not report success or expose partial privileges.
    // A compensating reconciliation workflow is required before retry.
    throw Error('SUPABASE_ROLE_BINDING_FAILED_REQUIRES_RECONCILIATION');
   }
   return {userId:data.user.id,tenantId,role,status:'INVITED'};
  }
 });
}
