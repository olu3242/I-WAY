import {SESSION_COOKIE,readAuthCookie} from './operations-supabase-pkce-session.experimental.mjs';
// B466: route-owned session authorization guard, framework-independent.
// Route handlers must provide trusted tenantId and role; never copy these from request input.
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(value);
export function createSessionHttpGuard({authorize,sessionCookieName=SESSION_COOKIE}={}){
 if(typeof authorize!=='function'||sessionCookieName!==SESSION_COOKIE)
  throw Error('SESSION_HTTP_GUARD_DEPENDENCIES_REQUIRED');
 return async function guard({headers,tenantId,role}={}){
  if(typeof tenantId!=='string'||!tenantId||typeof role!=='string'||!role)
   return {ok:false,status:403,error:'ACCESS_DENIED'};
  const sessionId=readAuthCookie(headers,sessionCookieName);
  if(!sessionId)return {ok:false,status:401,error:'AUTH_REQUIRED'};
  try{
   const result=await authorize({sessionId,tenantId,role});
   if(result?.ok===true&&typeof result.userId==='string'&&result.userId)
    return {ok:true,status:200,userId:result.userId};
  }catch{}
  return {ok:false,status:403,error:'ACCESS_DENIED'};
 };
}
