// B470: Node HTTP adapter for the protected pipeline, not enabled in Vercel routing.
// Keep all cookie, authorization and provider credentials on the server.
export function createNodeProtectedRouteHandler({pipeline}={}){
 if(typeof pipeline!=='function')throw Error('NODE_ROUTE_PIPELINE_REQUIRED');
 return async function handle(req,res){
  const method=req?.method;
  const rawUrl=req?.url;
  const validUrl=typeof rawUrl==='string'&&rawUrl.length<=4096&&/^\/[a-zA-Z0-9/_?=&.%-]*$/.test(rawUrl)&&!rawUrl.includes('\\\\')&&!/%2f|%5c|%2e/i.test(rawUrl);
  const path=validUrl?rawUrl.split('?')[0]:undefined;
  let result;
  try{result=validUrl?await pipeline({method,path,headers:req?.headers}):{status:404,body:'{"error":"NOT_FOUND"}'};}
  catch{result={status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:'{"error":"SERVICE_UNAVAILABLE"}'};}
  const status=[200,401,403,404,503].includes(result?.status)?result.status:503;
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  res.end(typeof result?.body==='string'&&status===result.status?result.body:'{"error":"SERVICE_UNAVAILABLE"}');
 };
}
