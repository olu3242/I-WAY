// AI-native decision contract: no side effects, no provider calls.
export const AUTONOMY = Object.freeze({ OBSERVE: 0, ADVISE: 1, ASSIST: 2, BOUNDED: 3, HUMAN_GOVERNED: 4 });

export function evaluateDecision(input, policy) {
  if (!input || !policy || typeof input !== 'object' || typeof policy !== 'object') throw new TypeError('Decision and policy required');
  const { tenantId, eventId, action, confidence, estimatedCost = 0, evidence = [] } = input;
  if (![tenantId, eventId, action].every(v => typeof v === 'string' && v.length > 0)) throw new TypeError('Missing decision identity');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new TypeError('Invalid confidence');
  if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost) || estimatedCost < 0) throw new TypeError('Invalid cost');
  if (!Array.isArray(evidence) || !evidence.every(v => typeof v === 'string')) throw new TypeError('Invalid evidence');
  if (policy.tenantId !== tenantId || policy.enabled !== true || !Array.isArray(policy.allowedActions) || !policy.allowedActions.includes(action)) {
    return { status: 'BLOCKED', reason: 'POLICY_DENIED', tenantId, eventId, action };
  }
  const level = policy.autonomyLevel;
  if (!Number.isInteger(level) || level < 0 || level > 4) return { status: 'BLOCKED', reason: 'INVALID_POLICY', tenantId, eventId, action };
  const threshold = policy.minimumConfidence;
  const cap = policy.maximumCost;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1 || typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0) {
    return { status: 'BLOCKED', reason: 'INVALID_POLICY', tenantId, eventId, action };
  }
  const base = { tenantId, eventId, action, evidence: [...evidence], policyVersion: policy.version ?? null };
  if (level === AUTONOMY.OBSERVE) return { ...base, status: 'OBSERVED' };
  if (level === AUTONOMY.ADVISE) return { ...base, status: 'ADVISED' };
  if (level === AUTONOMY.ASSIST) return { ...base, status: 'DRAFTED' };
  if (level === AUTONOMY.HUMAN_GOVERNED || confidence < threshold || estimatedCost > cap) return { ...base, status: 'APPROVAL_REQUIRED' };
  return { ...base, status: 'ELIGIBLE_FOR_ORCHESTRATION' };
}
