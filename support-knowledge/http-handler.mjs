// Internal-only SOP HTTP adapter. No trust in request-supplied identity.
import {handleSopRequest,submitSopTicket,advanceSopTicket} from './runtime.mjs';
const routes=new Map([
 ['POST /api/v1/support/resolve','resolve'],
 ['POST /api/v1/support/tickets','create']
]);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
export function createSopHttpHandler({verifySession,resolveResource,repository,repositoryForSession}={}){
 if(typeof verifySession!=='function'||typeof resolveResource!=='function'||(!repository&&typeof repositoryForSession!=='function'))throw Error('SOP_HTTP_DEPENDENCIES_REQUIRED');
 return async(req,res,url)=>{
  const transition=/^\/api\/v1\/support\/tickets\/([A-Za-z0-9_.-]{1,100})\/transitions$/.exec(url.pathname);
  const route=routes.get(req.method+' '+url.pathname)??(req.method==='POST'&&transition?'transition':null);
  if(!route){json(res,404,{error:'not_found'});return}
  if(req.headers['content-type']?.split(';')[0]!=='application/json'){json(res,415,{error:'json_required'});return}
  let session;
  try{session=await verifySession(req)}catch{json(res,401,{error:'unauthorized'});return}
  if(session?.verified!==true||session?.tenantMembershipVerified!==true){json(res,401,{error:'unauthorized'});return}
  let raw='',input;
  try{
   for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192){json(res,413,{error:'request_too_large'});return}}
   input=JSON.parse(raw);
   if(!input||typeof input!=='object'||Array.isArray(input))throw Error('bad_body');
  }catch{json(res,400,{error:'invalid_json'});return}
  // Resource identity comes from trusted server resolver, never JSON input.
  let resource;
  if(route!=='transition'){
   try{resource=await resolveResource({session,operation:route,req})}
   catch{json(res,403,{error:'forbidden'});return}
   if(!resource||resource.tenantId!==session.tenantId){json(res,403,{error:'forbidden'});return}
  }
  let scopedRepository=repository;
  try{if(repositoryForSession)scopedRepository=await repositoryForSession(session)}catch{json(res,503,{error:'support_unavailable'});return}
  if(!scopedRepository){json(res,503,{error:'support_unavailable'});return}
  let result;
  try{
   if(route==='resolve')result=await handleSopRequest({session,resource,message:input.message,repository:scopedRepository});
   else if(route==='create')result=await submitSopTicket({session,resource,subject:input.subject,priority:input.priority,repository:scopedRepository});
   else result=await advanceSopTicket({session,ticketId:transition[1],next:input.next,note:input.note,repository:scopedRepository});
  }catch{json(res,503,{error:'support_unavailable'});return}
  if(result?.status==='denied'){json(res,403,{error:'forbidden'});return}
  if(result?.status==='unavailable'){json(res,503,{error:'support_unavailable'});return}
  json(res,result?.status==='created'?201:200,result);
 };
}
