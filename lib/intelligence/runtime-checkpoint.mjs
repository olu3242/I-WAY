import { createHash } from 'node:crypto';
import { evaluateOperationalAdvice } from './operations-bridge.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Read-only compatibility adapter for the existing five-agent runtime.
// Caller must supply a server-authenticated principal and server-loaded resource.
export function classifyRuntimeCheckpoint({ principal, load, checkpoint, policy }) {
  if (!checkpoint || typeof checkpoint !== 'object' || !load || !principal ||
      checkpoint.tenantId !== load.tenantId || checkpoint.loadId !== load.id ||
      !['dispatch','tracking','documents','exceptions','finance'].includes(checkpoint.role) ||
      typeof checkpoint.id !== 'string' || typeof checkpoint.evidenceId !== 'string') {
    return { status: 'BLOCKED', reason: 'INVALID_CHECKPOINT' };
  }
  const action = 'review_' + checkpoint.role;
  const event = { id: checkpoint.id, tenantId: load.tenantId, loadId: load.id };
  const proposal = { tenantId: load.tenantId, eventId: checkpoint.id, action,
    confidence: 1, estimatedCost: 0, evidence: [checkpoint.evidenceId] };
  const decision = evaluateOperationalAdvice({ event, proposal, policy, principal, resource: load });
  return Object.freeze({ ...decision, role: checkpoint.role,
    checkpointDigest: digest([load.id, load.version, checkpoint.id, checkpoint.evidenceId, checkpoint.role]),
    executionPerformed: false });
}
