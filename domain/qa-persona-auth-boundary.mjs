/** Authenticate the request independently of any client-provided identity or role. */
export function createQaPersonaAuthBoundary({verifyBearer,service}={}){
 if(typeof verifyBearer!=='function'||!service)throw Error('QA_AUTH_PORTS_REQUIRED');
 async function subject(request){
  const header=request?.headers?.authorization;
  if(typeof header!=='string'||!/^Bearer [^\\s]+$/.test(header))throw Error('QA_UNAUTHENTICATED');
  let principal;
  try{principal=await verifyBearer(header.slice(7))}catch{throw Error('QA_UNAUTHENTICATED')}
  if(!principal?.subjectId||principal.active!==true)throw Error('QA_UNAUTHENTICATED');
  return principal.subjectId;
 }
 return Object.freeze({
  async start(request,{targetId,reason}={}){return service.start({authenticatedSubjectId:await subject(request),targetId,reason})},
  async resolve(request,{sessionId}={}){return service.resolve({authenticatedSubjectId:await subject(request),sessionId})},
  async stop(request,{sessionId}={}){return service.stop({authenticatedSubjectId:await subject(request),sessionId})}
 });
}
