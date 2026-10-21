// B466: route-owned session authorization guard, framework-independent.
// Route handlers must provide trusted tenantId and role; never copy these from request input.
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(value);
export function createSessionHttpGuard({authorize,sessionCookieName='iway_session'}={}){
 if(typeof authorize!=='function'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(sessionCookieName))
  throw Error('SESSION_HTTP_GUARD_DEPENDENCIES_REQUIRED');
 return async function guard({headers,tenantId,role}={}){
  if(typeof tenantId!=='string'||!tenantId||typeof role!=='string'||!role)
   return {ok:false,status:403,error:'ACCESS_DENIED'};
  const cookieHeader=headers?.cookie;
  if(typeof cookieHeader!=='string'||cookieHeader.length>8192)
   return {ok:false,status:401,error:'AUTH_REQUIRED'};
  const values=[];
  for(const entry of cookieHeader.split(';')){
   const index=entry.indexOf('=');
   if(index<0)continue;
   if(entry.slice(0,index).trim()===sessionCookieName)values.push(entry.slice(index+1).trim());
  }
  if(values.length!==1||!safeId(values[0]))
   return {ok:false,status:401,error:'AUTH_REQUIRED'};
  try{
   const result=await authorize({sessionId:values[0],tenantId,role});
   if(result?.ok===true&&typeof result.userId==='string'&&result.userId)
    return {ok:true,status:200,userId:result.userId};
  }catch{}
  return {ok:false,status:403,error:'ACCESS_DENIED'};
 };
}
