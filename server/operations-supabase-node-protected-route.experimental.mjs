import {readBoundedRequestBody} from './operations-supabase-bounded-body.experimental.mjs';
// B470: Node HTTP adapter for the protected pipeline, not enabled in Vercel routing.
// Keep all cookie, authorization and provider credentials on the server.
export function createNodeProtectedRouteHandler({pipeline,expectedOrigin}={}){
 if(typeof pipeline!=='function')throw Error('NODE_ROUTE_PIPELINE_REQUIRED');
 return async function handle(req,res){
  const method=req?.method;
  // A request already marked aborted must never enter a protected operation.
  const requestActive=req?.aborted!==true;
  const validMethod=typeof method==='string'&&['GET','POST','PUT','PATCH','DELETE'].includes(method);
  const mutating=['POST','PUT','PATCH','DELETE'].includes(method);
  const origin=req?.headers?.origin;
  const fetchSite=req?.headers?.['sec-fetch-site'];
  const validFetchSite=!mutating||fetchSite===undefined||fetchSite==='same-origin';
  const validOrigin=!mutating||(typeof expectedOrigin==='string'&&/^https:\/\/[^/?#]+$/.test(expectedOrigin)&&origin===expectedOrigin);
  const contentLength=req?.headers?.['content-length'];
  const validLength=!mutating||(
   contentLength===undefined||(
    typeof contentLength==='string'&&/^(0|[1-9][0-9]*)$/.test(contentLength)&&
    Number.isSafeInteger(Number(contentLength))&&Number(contentLength)<=65536
   )
  );
  const rawUrl=req?.url;
  const pathPart=typeof rawUrl==='string'?rawUrl.split('?')[0]:'';
  const validUrl=typeof rawUrl==='string'&&rawUrl.length<=4096&&/^\/[a-zA-Z0-9/_?=&.%-]*$/.test(rawUrl)&&!rawUrl.includes('\\\\')&&!rawUrl.includes('%')&&!pathPart.slice(1).split('/').some(segment=>segment==='.'||segment==='..'||segment==='');
  const path=validUrl?rawUrl.split('?')[0]:undefined;
  let result;
  try{
   if(requestActive&&validUrl&&validMethod&&validOrigin&&validFetchSite&&validLength){
    if(mutating&&typeof req?.[Symbol.asyncIterator]==='function')await readBoundedRequestBody(req);
    result=await pipeline({method,path,headers:req?.headers});
   }else result={status:404,body:'{"error":"NOT_FOUND"}'};
  }
  catch(error){result={status:error?.message==='BODY_TOO_LARGE'?413:503};}
  const status=[200,401,403,404,413,503].includes(result?.status)?result.status:503;
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  const safeBody={200:'{"ok":true}',401:'{"error":"AUTH_REQUIRED"}',403:'{"error":"ACCESS_DENIED"}',404:'{"error":"NOT_FOUND"}',413:'{"error":"PAYLOAD_TOO_LARGE"}',503:'{"error":"SERVICE_UNAVAILABLE"}'};
  res.end(safeBody[status]);
 };
}
