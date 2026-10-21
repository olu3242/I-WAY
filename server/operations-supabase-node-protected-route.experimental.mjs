// B470: Node HTTP adapter for the protected pipeline, not enabled in Vercel routing.
// Keep all cookie, authorization and provider credentials on the server.
export function createNodeProtectedRouteHandler({pipeline}={}){
 if(typeof pipeline!=='function')throw Error('NODE_ROUTE_PIPELINE_REQUIRED');
 return async function handle(req,res){
  const method=req?.method;
  const path=typeof req?.url==='string'?req.url.split('?')[0]:undefined;
  let result;
  try{result=await pipeline({method,path,headers:req?.headers});}
  catch{result={status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:'{"error":"SERVICE_UNAVAILABLE"}'};}
  const status=[200,401,403,404,503].includes(result?.status)?result.status:503;
  res.statusCode=status;
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  res.end(typeof result?.body==='string'&&status===result.status?result.body:'{"error":"SERVICE_UNAVAILABLE"}');
 };
}
