/** QA persona switching authorization policy.
 * This module grants no permissions and never changes the authenticated actor.
 * The session service must verify the actor and persist/revoke audited grants.
 */
export const QA_ROLES = Object.freeze(['platform_admin','carrier_admin','fleet_admin','driver']);
const roles = new Set(QA_ROLES);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const maxDurationMs = 15 * 60 * 1000;

/** Fail closed; production must not activate impersonation, even with an env flag. */
export function canStartQaPersonaSwitch({environment,enabled,actor,target,now=Date.now(),expiresAt}={}) {
 if(environment !== 'test' && environment !== 'development' && environment !== 'preview') return false;
 if(enabled !== true || !actor || !target || !Number.isFinite(now) || !Number.isFinite(expiresAt)) return false;
 if(actor.verified !== true || actor.active !== true || actor.role !== 'platform_admin' || actor.qaPersonaSwitchAllowed !== true) return false;
 if(!uuid(actor.id) || !uuid(target.id) || !uuid(target.tenantId) || actor.id === target.id) return false;
 if(target.active !== true || target.qaAccount !== true || !roles.has(target.role) || target.role === 'platform_admin') return false;
 if(expiresAt <= now || expiresAt - now > maxDurationMs) return false;
 return true;
}

/** Both the real actor and effective principal must be checked for every request.
 * Caller must separately verify signed session, revocation, tenant membership, and RLS.
 */
export function qaPersonaSwitchContext({grant,actor,target,now=Date.now()}={}) {
 if(!grant || grant.revoked === true || grant.active !== true || !Number.isFinite(now) ||
    !canStartQaPersonaSwitch({environment:grant.environment,enabled:grant.enabled,actor,target,now,expiresAt:grant.expiresAt}) ||
    grant.actorId !== actor.id || grant.targetId !== target.id || grant.tenantId !== target.tenantId ||
    !uuid(grant.id) || !Number.isFinite(grant.issuedAt) || grant.issuedAt > now || grant.expiresAt <= now) return null;
 return Object.freeze({realActorId:actor.id,effectiveActorId:target.id,tenantId:target.tenantId,effectiveRole:target.role,grantId:grant.id,expiresAt:grant.expiresAt});
}
