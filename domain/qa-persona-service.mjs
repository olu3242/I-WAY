import {randomUUID} from 'node:crypto';
import {canStartQaPersona,resolveQaPersona} from './qa-persona-policy.mjs';

/** Server-only orchestration. Ports must resolve authenticated identities and persist
 * sessions/audit in a trusted transactional backend. No browser role inputs.
 */
export function createQaPersonaService({resolveActor,resolveTarget,saveSession,readSession,revokeSession,appendAudit,enabled=false,environment,clock=Date.now}={}){
 const ports=[resolveActor,resolveTarget,saveSession,readSession,revokeSession,appendAudit];
 if(ports.some(port=>typeof port!=='function'))throw Error('QA_PERSONA_PORTS_REQUIRED');
 const now=()=>clock();
 return Object.freeze({
  async start({authenticatedSubjectId,targetId,reason}={}){
   if(!authenticatedSubjectId||!targetId)throw Error('QA_PERSONA_DENIED');
   const actor=await resolveActor(authenticatedSubjectId);
   const target=await resolveTarget(targetId);
   if(!canStartQaPersona({actor,target,reason,enabled,environment}))throw Error('QA_PERSONA_DENIED');
   const issuedAt=now();
   if(!Number.isSafeInteger(issuedAt))throw Error('QA_PERSONA_CLOCK_INVALID');
   const session={id:randomUUID(),actorId:actor.id,targetId:target.id,tenantId:target.tenantId,role:target.role,reason,issuedAt,expiresAt:issuedAt+15*60*1000,revoked:false};
   await saveSession(session);
   await appendAudit({event:'qa_persona_started',actorId:actor.id,effectiveActorId:target.id,tenantId:target.tenantId,sessionId:session.id,at:issuedAt});
   return {sessionId:session.id,expiresAt:session.expiresAt};
  },
  async resolve({authenticatedSubjectId,sessionId}={}){
   if(!authenticatedSubjectId||!sessionId)return null;
   const actor=await resolveActor(authenticatedSubjectId);
   if(!actor)return null;
   const session=await readSession(sessionId);
   if(!session||session.actorId!==actor.id)return null;
   const target=await resolveTarget(session.targetId);
   return resolveQaPersona({actor,target,session,enabled,environment,now:now()});
  },
  async stop({authenticatedSubjectId,sessionId}={}){
   const context=await this.resolve({authenticatedSubjectId,sessionId});
   if(!context)throw Error('QA_PERSONA_DENIED');
   await revokeSession(sessionId);
   await appendAudit({event:'qa_persona_stopped',actorId:context.originalActorId,effectiveActorId:context.effectiveActorId,tenantId:context.tenantId,sessionId,at:now()});
   return {revoked:true};
  }
 });
}
