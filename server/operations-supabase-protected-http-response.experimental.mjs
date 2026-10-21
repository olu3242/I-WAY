// B468: framework-neutral HTTP response boundary for protected routes.
// Never serialize provider credentials or internal authorization objects.
export function createProtectedHttpHandler({authorizeRequest,handleAuthorized}={}){
 if(typeof authorizeRequest!=='function'||typeof handleAuthorized!=='function')
  throw Error('PROTECTED_HTTP_DEPENDENCIES_REQUIRED');
 return async function handle({method,path,headers,prepareAuthorized}={}){
  const responseHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  try{
   const auth=await authorizeRequest({method,path,headers});
   if(auth?.ok!==true){
    const status=[401,403,404].includes(auth?.status)?auth.status:403;
    return {status,headers:responseHeaders,body:JSON.stringify({error:status===401?'AUTH_REQUIRED':status===404?'NOT_FOUND':'ACCESS_DENIED'})};
   }
   const body=typeof prepareAuthorized==='function'?await prepareAuthorized():undefined;
   const result=await handleAuthorized({userId:auth.userId,method,path,...(body===undefined?{}:{body})});
   if(result?.ok!==true)return {status:503,headers:responseHeaders,body:JSON.stringify({error:'SERVICE_UNAVAILABLE'})};
   return {status:200,headers:responseHeaders,body:JSON.stringify({ok:true})};
  }catch(error){const status=error?.message==='BODY_TOO_LARGE'?413:503;return {status,headers:responseHeaders,body:JSON.stringify({error:status===413?'PAYLOAD_TOO_LARGE':'SERVICE_UNAVAILABLE'})};}
 };
}
