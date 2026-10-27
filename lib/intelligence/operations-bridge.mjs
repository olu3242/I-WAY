import { evaluateDecision } from './decision-plane.mjs';

// Advisory-only bridge. The existing operations runtime remains the sole authority
// for shipment writes, approvals and worker dispatch.
export function evaluateOperationalAdvice({ event, proposal, policy, principal, resource }) {
  if (!principal || !resource || principal.active !== true ||
      principal.tenantId !== resource.tenantId ||
      principal.tenantId !== event?.tenantId ||
      proposal?.tenantId !== principal.tenantId ||
      proposal?.eventId !== event?.id ||
      resource.id !== event?.loadId) {
    return { status: 'BLOCKED', reason: 'UNTRUSTED_CONTEXT' };
  }
  if (!Array.isArray(principal.permissions) || !principal.permissions.includes('intelligence:analyze')) {
    return { status: 'BLOCKED', reason: 'MISSING_PERMISSION' };
  }
  const result = evaluateDecision(proposal, policy);
  // No AI-generated advice is an execution authorization. Even an L3
  // eligible proposal must pass existing operations guards and workflow gates.
  if (result.status === 'ELIGIBLE_FOR_ORCHESTRATION') {
    return { ...result, status: 'ADVISORY_READY', requiresWorkflowAuthorization: true };
  }
  return result;
}
