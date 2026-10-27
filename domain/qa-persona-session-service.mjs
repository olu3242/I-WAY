import {randomUUID} from 'node:crypto';
import {canStartQaPersonaSwitch,qaPersonaSwitchContext} from './qa-persona-switch-policy.mjs';

/** Authenticated, auditable QA session service. Ports MUST be backed by durable storage
 * and trusted identity lookups; never pass client-provided principals or roles.
 */
export function createQaPersonaSessionService({lookupActor,lookupTarget,saveGrant,loadGrant,revokeGrant,appendAudit,environment,enabled=false,now=()=>Date.now()}={}){
 const required=[lookupActor,lookupTarget,saveGrant,loadGrant,revokeGrant,appendAudit];
 if(required.some(fn=>typeof fn!=='function'))throw Error('QA_SESSION_PORTS_REQUIRED');
 const audit=async (action,actorId,detail)=>appendAudit({action,actorId,detail,at:new Date(now()).toISOString()});
 return Object.freeze({
  async start({authenticatedActorId,targetId}={}){
   const actor=await lookupActor(authenticatedActorId),target=await lookupTarget(targetId);
   const issuedAt=now(),expiresAt=issuedAt+15*60*1000;
   if(!canStartQaPersonaSwitch({environment,enabled,actor,target,now:issuedAt,expiresAt})){
    await audit('qa:switch:denied',authenticatedActorId,{targetId});
    return null;
   }
   const grant={id:randomUUID(),actorId:actor.id,targetId:target.id,tenantId:target.tenantId,environment,enabled:true,active:true,revoked:false,issuedAt,expiresAt};
   await saveGrant(grant);
   await audit('qa:switch:start',actor.id,{grantId:grant.id,targetId:target.id,tenantId:target.tenantId});
   return {grantId:grant.id,expiresAt};
  },
  async resolve({authenticatedActorId,grantId}={}){
   if(typeof authenticatedActorId!=='string'||typeof grantId!=='string')return null;
   const grant=await loadGrant(grantId);
   if(!grant||grant.actorId!==authenticatedActorId)return null;
   const actor=await lookupActor(authenticatedActorId),target=await lookupTarget(grant.targetId);
   return qaPersonaSwitchContext({grant,actor,target,now:now()});
  },
  async stop({authenticatedActorId,grantId}={}){
   const context=await this.resolve({authenticatedActorId,grantId});
   if(!context)return false;
   await revokeGrant(grantId,authenticatedActorId);
   await audit('qa:switch:stop',authenticatedActorId,{grantId,targetId:context.effectiveActorId});
   return true;
  }
 });
}
