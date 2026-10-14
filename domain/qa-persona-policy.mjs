/** QA-only persona delegation. Never use client-supplied role or tenant as authority.
 * This policy validates server-resolved principals and a server-persisted session.
 * Issuance, persistence, revocation, and append-only auditing belong to the host adapter.
 */
export const QA_PERSONA_ROLES=Object.freeze(['carrier','fleet','driver']);
export function canStartQaPersona({actor,target,enabled=false,environment,reason}={}){
 if(enabled!==true||!['test','development','preview','staging'].includes(environment))return false;
 if(!actor||actor.active!==true||actor.role!=='platform_admin'||actor.qaPersonaSwitch!==true)return false;
 if(!actor.id||!target||target.active!==true||!target.id||actor.id===target.id)return false;
 if(!QA_PERSONA_ROLES.includes(target.role)||!target.tenantId)return false;
 if(typeof reason!=='string'||reason.trim().length<8||reason.length>500)return false;
 return true;
}
export function resolveQaPersona({actor,target,session,enabled=false,environment,now=Date.now()}={}){
 if(!session||session.revoked===true||session.actorId!==actor?.id||session.targetId!==target?.id)return null;
 if(!Number.isSafeInteger(session.issuedAt)||!Number.isSafeInteger(session.expiresAt))return null;
 if(session.issuedAt>now||session.expiresAt<=now||session.expiresAt-session.issuedAt>15*60*1000)return null;
 if(!canStartQaPersona({actor,target,enabled,environment,reason:session.reason}))return null;
 if(session.tenantId!==target.tenantId||session.role!==target.role)return null;
 return Object.freeze({originalActorId:actor.id,effectiveActorId:target.id,tenantId:target.tenantId,role:target.role,sessionId:session.id});
}
