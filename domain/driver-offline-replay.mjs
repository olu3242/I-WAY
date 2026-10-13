// FCC-03: fail-closed command replay policy. No browser persistence or network access.
// The caller must provide a reviewed, actor-bound durable store before enabling offline mode.
const ACTIONS = new Set(['load:accept','load:pickup','load:transit']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
export const OFFLINE_COMMAND_SCHEMA = 1;
export const MAX_OFFLINE_COMMANDS = 20;
export const MAX_OFFLINE_AGE_MS = 24 * 60 * 60 * 1000;

export function validateOfflineCommand(entry, context, now = Date.now()) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('OFFLINE_INVALID');
  const allowed = ['sessionId','schemaVersion','tenantId','actorId','action','resourceId','expectedVersion','idempotencyKey','createdAt','payload'];
  if (Object.keys(entry).some(key => !allowed.includes(key))) throw new Error('OFFLINE_UNEXPECTED_FIELD');
  if (entry.schemaVersion !== OFFLINE_COMMAND_SCHEMA || !ACTIONS.has(entry.action)) throw new Error('OFFLINE_UNSUPPORTED');
  if (!context || entry.tenantId !== context.tenantId || entry.actorId !== context.actorId ||
      !ID.test(entry.tenantId ?? '') || !ID.test(entry.actorId ?? '')) throw new Error('OFFLINE_IDENTITY_MISMATCH');
  if (context.sessionId && entry.sessionId !== context.sessionId) throw new Error('OFFLINE_SESSION_MISMATCH');
  if (!ID.test(entry.resourceId ?? '') || !Number.isSafeInteger(entry.expectedVersion) || entry.expectedVersion < 1 ||
      !UUID.test(entry.idempotencyKey ?? '')) throw new Error('OFFLINE_INVALID');
  if (!Number.isSafeInteger(entry.createdAt) || entry.createdAt > now ||
      now - entry.createdAt > MAX_OFFLINE_AGE_MS) throw new Error('OFFLINE_EXPIRED');
  if (!entry.payload || Object.keys(entry.payload).length !== 0 || Array.isArray(entry.payload)) throw new Error('OFFLINE_PAYLOAD_DENIED');
  return Object.freeze({ ...entry, payload: Object.freeze({}) });
}

export function validateOfflineQueue(entries, context, now = Date.now()) {
  if (!Array.isArray(entries) || entries.length > MAX_OFFLINE_COMMANDS) throw new Error('OFFLINE_QUEUE_LIMIT');
  const keys = new Set();
  return entries.map(entry => {
    const valid = validateOfflineCommand(entry, context, now);
    if (keys.has(valid.idempotencyKey)) throw new Error('OFFLINE_DUPLICATE_KEY');
    keys.add(valid.idempotencyKey);
    return valid;
  });
}

// No automatic retry on authorization, conflict or unknown failure.
// Never claim success without an authenticated server response.
export async function replayOfflineCommands({ entries, context, send, now = Date.now() }) {
  if (typeof send !== 'function') throw new Error('OFFLINE_SEND_REQUIRED');
  const validated = validateOfflineQueue(entries, context, now);
  const receipts = [];
  for (const entry of validated) {
    let response;
    try {
      response = await send({
        action: entry.action, resourceId: entry.resourceId,
        expectedVersion: entry.expectedVersion, idempotencyKey: entry.idempotencyKey,
        payload: {}
      });
    } catch {
      return { status: 'needs_attention', confirmed: receipts, remaining: validated.slice(receipts.length) };
    }
    if (!response || response.confirmed !== true || response.idempotencyKey !== entry.idempotencyKey) {
      return { status: 'needs_attention', confirmed: receipts, remaining: validated.slice(receipts.length) };
    }
    receipts.push({ idempotencyKey: entry.idempotencyKey, status: 'confirmed_by_server' });
  }
  return { status: 'confirmed_by_server', confirmed: receipts, remaining: [] };
}
