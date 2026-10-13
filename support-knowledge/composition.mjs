// B11: opt-in composition of verified identity, scoped persistence and SOP HTTP.
// Production startup must supply a genuine token verifier, membership lookup and
// restricted PostgreSQL pool. Never accept client-supplied identity or database URLs.
import {createSopSessionVerifier} from './session-verifier.mjs';
import {createBoundSopRepository} from './bound-repository.mjs';
import {createSopHttpHandler} from './http-handler.mjs';
export function createSopComposition({verifyBearerToken,lookupMembership,pool,resolveResource}={}){
 if(typeof verifyBearerToken!=='function'||typeof lookupMembership!=='function'||typeof pool?.connect!=='function'||typeof resolveResource!=='function')throw Error('SOP_COMPOSITION_DEPENDENCIES_REQUIRED');
 const verifySession=createSopSessionVerifier({verifyBearerToken,lookupMembership});
 return createSopHttpHandler({
  verifySession,
  resolveResource:async ({session,operation,req})=>{
   const resource=await resolveResource({session,operation,req});
   if(!resource||resource.tenantId!==session.tenantId)throw Error('SOP_RESOURCE_SCOPE_DENIED');
   return resource;
  },
  repositoryForSession:session=>createBoundSopRepository(pool,session)
 });
}
