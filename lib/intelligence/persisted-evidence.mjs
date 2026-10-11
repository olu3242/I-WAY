import { classifyRuntimeCheckpoint } from './runtime-checkpoint.mjs';

// Read-only projection of immutable evidence created by the existing runtime.
// This does not create jobs, mutate evidence, or authorize consequential actions.
export function classifyPersistedAgentDecision({ principal, load, evidence, policy }) {
  if (!evidence || evidence.kind !== 'agentdecision' ||
      typeof evidence.id !== 'string' || typeof evidence.jobId !== 'string' ||
      !Number.isSafeInteger(evidence.checkpoint) || evidence.checkpoint < 0 ||
      !Number.isSafeInteger(evidence.runNumber) || evidence.runNumber < 1 ||
      evidence.loadId !== load?.id || evidence.tenantId !== load?.tenantId ||
      evidence.consequentialAction !== false || evidence.provenance?.live !== false ||
      evidence.provenance?.model !== null) {
    return { status: 'BLOCKED', reason: 'UNTRUSTED_EVIDENCE' };
  }
  return classifyRuntimeCheckpoint({ principal, load, policy, checkpoint: {
    id: evidence.jobId + ':' + evidence.runNumber + ':' + evidence.checkpoint,
    tenantId: evidence.tenantId, loadId: evidence.loadId,
    role: evidence.role, evidenceId: evidence.id
  } });
}
