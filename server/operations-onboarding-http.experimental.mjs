// B400 experimental HTTP boundary; isolated fixture use only.
// The server owns verifier and provisioning dependencies. No public route wiring.
import {createServer} from 'node:http';
export function createIsolatedOnboardingHttpServer({verifiedProvisioning}){
 if(!verifiedProvisioning||typeof verifiedProvisioning.provision!=='function')
  throw Error('HTTP_PROVISIONING_CONFIGURATION_REQUIRED');
 return createServer(async(req,res)=>{
  const respond=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='POST'||req.url!=='/experimental/onboarding/provision')
   return respond(404,{error:'NOT_FOUND'});
  let raw='';
  try{
   for await(const chunk of req){
    raw+=chunk.toString('utf8');
    if(raw.length>16384)throw Error('REQUEST_TOO_LARGE');
   }
   const body=JSON.parse(raw);
   if(!body||typeof body!=='object'||Array.isArray(body))throw Error('INVALID_REQUEST');
   // No client-provided verified identity is accepted; verifier owns claims.
   const result=await verifiedProvisioning.provision({
    invitationId:body.invitationId,tenantId:body.tenantId,actorId:body.actorId,
    role:body.role,token:body.token,expectedNonce:body.expectedNonce
   });
   return respond(200,{state:result.state,invitationId:result.invitationId});
  }catch{
   return respond(403,{error:'PROVISIONING_DENIED'});
  }
 });
}
