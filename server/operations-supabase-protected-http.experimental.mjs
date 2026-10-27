// B452-B459: strict HTTP authorization boundary, dependency-injected for isolated tests.
// Caller must supply a verified Supabase getUser implementation and private role store.
import {createSupabaseTenantAuthorization} from './operations-supabase-tenant-authorization.experimental.mjs';
export function createIwayProtectedHttpHandler({getUser,roleStore,handleAuthorized}={}){
 if(typeof handleAuthorized!=='function')throw Error('IWAY_HANDLER_REQUIRED');
 const guard=createSupabaseTenantAuthorization({getUser,roleStore});
 return async function protectedRequest(req){
  const headers=req?.headers||{};
  const authorization=typeof headers.get==='function'?headers.get('authorization'):headers.authorization;
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))
   return {status:401,body:{error:'UNAUTHORIZED'}};
  // Tenant and role are route policy, not user-controlled body or query parameters.
  const tenantId=req?.policy?.tenantId,role=req?.policy?.role;
  if(typeof tenantId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
   ||!['carrier','fleet','platform','driver'].includes(role))
   return {status:403,body:{error:'FORBIDDEN'}};
  const result=await guard.authorize({accessToken:authorization.slice(7),tenantId,role});
  if(!result.allowed)return {status:result.reason==='MISSING_SESSION'||result.reason==='INVALID_SESSION'?401:403,body:{error:'FORBIDDEN'}};
  return handleAuthorized({request:req,userId:result.userId,tenantId,role});
 };
}
