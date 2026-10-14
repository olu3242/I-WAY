// B239-B240: Cross-workflow evidence gate, not an invoice issuer or document reviewer.
// Persisted evidence must be independently verified by the owning domain at execution time.
import {createHash} from 'node:crypto';
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const HASH=/^[a-f0-9]{64}$/;
const permitted=new Set(['invoice:prepare','document:advance']);
const deny=(code,ctx)=>Object.freeze({status:'BLOCKED',reason:code,tenantId:ctx.tenantId,loadId:ctx.loadId,executionReceipt:null,externalDelivery:false});
export function evaluateFinanceDocumentGate(ctx) {
 if(!ctx || typeof ctx!=='object' || Array.isArray(ctx))throw new TypeError('WORKFLOW_CONTEXT');
 const keys=['tenantId','loadId','loadVersion','action','principalId','authorized','loadDelivered','bolValidated','podAcknowledged','documentIntegrity','documentReviewCurrent','financialApproval','invoiceAlreadyIssued','evidenceDigest'];
 if(Object.keys(ctx).some(k=>!keys.includes(k)))throw new TypeError('WORKFLOW_FIELDS');
 if(![ctx.tenantId,ctx.loadId,ctx.principalId].every(v=>typeof v==='string'&&ID.test(v)) || !permitted.has(ctx.action) || !Number.isSafeInteger(ctx.loadVersion)||ctx.loadVersion<1 || typeof ctx.evidenceDigest!=='string'||!HASH.test(ctx.evidenceDigest))throw new TypeError('WORKFLOW_IDENTITY');
 const flags=['authorized','loadDelivered','bolValidated','podAcknowledged','documentIntegrity','documentReviewCurrent','financialApproval','invoiceAlreadyIssued'];
 if(!flags.every(k=>typeof ctx[k]==='boolean'))throw new TypeError('WORKFLOW_FLAGS');
 if(!ctx.authorized)return deny('AUTHORITY_DENIED',ctx);
 if(!ctx.documentIntegrity)return deny('DOCUMENT_INTEGRITY',ctx);
 if(!ctx.documentReviewCurrent || !ctx.bolValidated)return deny('DOCUMENT_REVIEW_REQUIRED',ctx);
 if(ctx.action==='invoice:prepare'){
  if(!ctx.loadDelivered)return deny('SHIPMENT_NOT_DELIVERED',ctx);
  if(!ctx.podAcknowledged)return deny('POD_MISSING',ctx);
  if(ctx.invoiceAlreadyIssued)return deny('INVOICE_EXISTS',ctx);
  if(!ctx.financialApproval)return deny('FINANCIAL_APPROVAL_REQUIRED',ctx);
 }
 const digest=createHash('sha256').update(JSON.stringify([ctx.tenantId,ctx.loadId,ctx.loadVersion,ctx.action,ctx.evidenceDigest])).digest('hex');
 return Object.freeze({status:'ELIGIBLE_FOR_HUMAN_WORKFLOW',tenantId:ctx.tenantId,loadId:ctx.loadId,action:ctx.action,loadVersion:ctx.loadVersion,evidenceDigest:ctx.evidenceDigest,idempotencyKey:digest,executionReceipt:null,externalDelivery:false});
}
