// B470: Node HTTP adapter for the protected pipeline, not enabled in Vercel routing.
// Keep all cookie, authorization and provider credentials on the server.
export function createNodeProtectedRouteHandler({pipeline}={}){
 if(typeof pipeline!=='function')throw Error('NODE_ROUTE_PIPELINE_REQUIRED');
 return async function handle(req,res){
  const method=req?.method;
  const rawUrl=req?.url;
  const pathPart=typeof rawUrl==='string'?rawUrl.split('?')[0]:'';
  const validUrl=typeof rawUrl==='string'&&rawUrl.length<=4096&&/^\/[a-zA-Z0-9/_?=&.%-]*$/.test(rawUrl)&&!rawUrl.includes('\\\\')&&!rawUrl.includes('%')&&!pathPart.slice(1).split('/').some(segment=>segment==='.'||segment==='..'||segment==='');
  const path=validUrl?rawUrl.split('?')[0]:undefined;
  let result;
  try{result=validUrl?await pipeline({method,path,headers:req?.headers}):{status:404,body:'{"error":"NOT_FOUND"}'};}
  catch{result={status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:'{"error":"SERVICE_UNAVAILABLE"}'};}
  const status=[200,401,403,404,503].includes(result?.status)?result.status:503;
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  const safeBody={200:'{"ok":true}',401:'{"error":"AUTH_REQUIRED"}',403:'{"error":"ACCESS_DENIED"}',404:'{"error":"NOT_FOUND"}',503:'{"error":"SERVICE_UNAVAILABLE"}'};
  res.end(safeBody[status]);
 };
}
