// Tenant AI policies are inert until explicitly approved by a human carrier.
// Pure lifecycle transitions; persistence and authorization belong to Operations.
export function transitionAIPolicy(current, command, actor) {
  if (!actor?.active || actor.role !== 'carrier' || typeof actor.tenantId !== 'string' ||
      !actor.permissions?.includes('governance:manage')) {
    return { accepted:false, reason:'UNAUTHORIZED' };
  }
  if (!command || !['propose','approve','revoke'].includes(command.action) ||
      (current && current.tenantId !== actor.tenantId)) return {accepted:false,reason:'INVALID_TRANSITION'};
  if (command.action === 'propose') {
    const p=command.policy;
    if (!p || p.tenantId !== actor.tenantId || p.enabled !== true ||
        !Array.isArray(p.allowedActions) || !p.allowedActions.length ||
        !p.allowedActions.every(x=>typeof x==='string'&&/^review_(dispatch|tracking|documents|exceptions|finance)$/.test(x)) ||
        new Set(p.allowedActions).size !== p.allowedActions.length ||
        !Number.isInteger(p.autonomyLevel) || p.autonomyLevel<0 || p.autonomyLevel>4 ||
        !Number.isFinite(p.minimumConfidence) || p.minimumConfidence<0 || p.minimumConfidence>1 ||
        !Number.isFinite(p.maximumCost) || p.maximumCost<0) return {accepted:false,reason:'INVALID_POLICY'};
    return {accepted:true,policy:{tenantId:p.tenantId,allowedActions:[...p.allowedActions],autonomyLevel:p.autonomyLevel,minimumConfidence:p.minimumConfidence,maximumCost:p.maximumCost,enabled:false,version:(current?.version??0)+1,
      lifecycle:'PENDING_APPROVAL',proposedBy:actor.id,approvedBy:null}};
  }
  if (!current || command.expectedVersion !== current.version) return {accepted:false,reason:'STALE_POLICY'};
  if (command.action==='approve') {
    if (current.lifecycle!=='PENDING_APPROVAL'||current.proposedBy===actor.id)
      return {accepted:false,reason:'SEPARATION_OF_DUTIES'};
    return {accepted:true,policy:{...current,enabled:true,lifecycle:'APPROVED',
      version:current.version+1,approvedBy:actor.id}};
  }
  if (current.lifecycle!=='APPROVED') return {accepted:false,reason:'INVALID_TRANSITION'};
  return {accepted:true,policy:{...current,enabled:false,lifecycle:'REVOKED',
    version:current.version+1,revokedBy:actor.id}};
}
