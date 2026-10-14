// B234-B235: Pure, bounded cross-application coordination contract.
// Produces an immutable, non-executing envelope; dispatch and finance must
// still pass their existing authorization, transaction and approval gates.
import {createHash} from 'node:crypto';

const KINDS = Object.freeze({
  'shipment.status_changed': ['driver', 'carrier', 'fleet', 'platform'],
  'shipment.exception_reported': ['carrier', 'fleet', 'platform'],
  'document.review_completed': ['carrier', 'platform'],
  'finance.invoice_ready': ['carrier', 'platform']
});
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const allowed = (v) => typeof v === 'string' && ID.test(v);
const exactKeys = (v, keys) => Object.keys(v).every(k => keys.includes(k));

export function coordinateIntegrationEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('EVENT_INVALID');
  if (!exactKeys(input, ['tenantId','eventId','kind','resourceId','resourceVersion','occurredAt','sourceApp','targetApp','evidenceDigest'])) throw new TypeError('EVENT_FIELDS');
  const {tenantId,eventId,kind,resourceId,resourceVersion,occurredAt,sourceApp,targetApp,evidenceDigest} = input;
  if (![tenantId,eventId,resourceId,sourceApp,targetApp].every(allowed)) throw new TypeError('EVENT_IDENTITY');
  if (!Object.hasOwn(KINDS,kind) || !KINDS[kind].includes(sourceApp) || !KINDS[kind].includes(targetApp) || sourceApp===targetApp) throw new TypeError('EVENT_ROUTE');
  if (!Number.isSafeInteger(resourceVersion) || resourceVersion < 1) throw new TypeError('EVENT_VERSION');
  if (typeof occurredAt!=='string' || !ISO.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt)) || new Date(occurredAt).toISOString()!==occurredAt) throw new TypeError('EVENT_TIME');
  if (typeof evidenceDigest!=='string' || !/^[a-f0-9]{64}$/.test(evidenceDigest)) throw new TypeError('EVENT_EVIDENCE');
  const canonical = JSON.stringify([tenantId,eventId,kind,resourceId,resourceVersion,occurredAt,sourceApp,targetApp,evidenceDigest]);
  return Object.freeze({
    tenantId,eventId,kind,resourceId,resourceVersion,occurredAt,sourceApp,targetApp,evidenceDigest,
    idempotencyKey:createHash('sha256').update(canonical).digest('hex'),
    status:'ELIGIBLE_FOR_ORCHESTRATION',
    executionReceipt:null,
    externalDelivery:false
  });
}
