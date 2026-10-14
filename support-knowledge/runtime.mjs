// SOP runtime boundary: verified session and tenant-scoped repository required.
// No direct database writes, AI action execution, or hosted authorization.
import {resolveSupportRequest} from './orchestrator.mjs';
import {createTicket,transitionTicket} from './tickets.mjs';
import {authorize} from './access.mjs';
const roles=new Set(['driver','owner_operator','dispatcher','carrier_admin','carrier_operations','fleet_manager','fleet_admin','fleet_compliance','shipper','finance','support','platform_operations','security','platform_admin']);
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(x);
function verifiedActor(session){
 if(!session||session.verified!==true||session.tenantMembershipVerified!==true||!safeId(session.subjectId)||!safeId(session.tenantId)||!roles.has(session.role))return null;
 return {id:session.subjectId,tenantId:session.tenantId,role:session.role};
}
function scopedResource(actor,resource){
 if(!resource||resource.tenantId!==actor.tenantId)return null;
 return {tenantId:actor.tenantId,ownerId:resource.ownerId,allowedRoles:resource.allowedRoles};
}
export async function handleSopRequest({session,message,resource,repository,now=new Date()}){
 const actor=verifiedActor(session);
 if(!actor)return {status:'denied',reason:'verified_session_required'};
 const scoped=scopedResource(actor,resource);
 if(!scoped||!authorize(actor,'knowledge:read',scoped))return {status:'denied',reason:'unauthorized_resource'};
 if(!repository||typeof repository.listApprovedArticles!=='function')return {status:'unavailable',reason:'repository_not_configured'};
 let articles;
 try{articles=await repository.listApprovedArticles({tenantId:actor.tenantId,role:actor.role});}
 catch{return {status:'unavailable',reason:'repository_error'};}
 if(!Array.isArray(articles))return {status:'unavailable',reason:'repository_invalid'};
 // Recheck every returned row; repository output is not an authorization grant.
 if(articles.some(a=>!a||a.tenantId!==actor.tenantId))return {status:'unavailable',reason:'repository_scope_violation'};
 return resolveSupportRequest({actor,message,articles,resource:scoped,now});
}
export async function submitSopTicket({session,resource,subject,priority,repository}){
 const actor=verifiedActor(session);
 if(!actor)return {status:'denied',reason:'verified_session_required'};
 const scoped=scopedResource(actor,resource);
 if(!scoped)return {status:'denied',reason:'unauthorized_resource'};
 const draft=createTicket({actor,resource:scoped,subject,priority});
 if(draft.status==='denied')return draft;
 // No fake success: only a real transactional repository may confirm persistence.
 if(typeof repository?.createTicketTransaction!=='function')return {status:'unavailable',reason:'persistence_not_configured'};
 try{
  const receipt=await repository.createTicketTransaction({tenantId:actor.tenantId,actorId:actor.id,ticket:draft});
  if(!receipt||receipt.persisted!==true||receipt.tenantId!==actor.tenantId||!safeId(receipt.ticketId))return {status:'unavailable',reason:'persistence_unverified'};
  return {status:'created',ticketId:receipt.ticketId,tenantId:actor.tenantId};
 }catch{return {status:'unavailable',reason:'persistence_failed'};}
}
export async function advanceSopTicket({session,ticketId,next,note='',repository}){
 const actor=verifiedActor(session);
 if(!actor||!safeId(ticketId))return {status:'denied'};
 if(typeof repository?.transitionTicketTransaction!=='function')return {status:'unavailable',reason:'persistence_not_configured'};
 if(!authorize(actor,'ticket:triage',{tenantId:actor.tenantId}))return {status:'denied'};
 // The transaction adapter must enforce tenant, state and concurrency atomically.
 try{
  const receipt=await repository.transitionTicketTransaction({tenantId:actor.tenantId,actorId:actor.id,ticketId,next,note});
  if(!receipt||receipt.persisted!==true||receipt.tenantId!==actor.tenantId||receipt.ticketId!==ticketId)return {status:'unavailable',reason:'persistence_unverified'};
  return {status:'transitioned',ticketId,transition:next};
 }catch{return {status:'unavailable',reason:'persistence_failed'};}
}
