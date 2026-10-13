// B236-B238: Read-only decision gate. Never dispatches, assigns, or resolves exceptions.
// Existing domain commands remain the sole source of operational side effects.
import {evaluateDecision} from './decision-plane.mjs';

const ACTIONS = new Set(['dispatch:assign','capacity:recommend','exception:recover']);
const safeId = v => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const block=(reason,context)=>Object.freeze({status:'BLOCKED',reason,tenantId:context?.tenantId??null,eventId:context?.eventId??null,executionReceipt:null});

export function evaluateDispatchOrchestration(context,policy) {
  if(!context || typeof context!=='object' || Array.isArray(context)) throw new TypeError('DISPATCH_CONTEXT');
  const keys=['tenantId','eventId','action','loadId','loadVersion','principalId','principalActive','authorized','eligible','openExceptions','documentReady','approvalRecorded','confidence','estimatedCost','evidence'];
  if(Object.keys(context).some(k=>!keys.includes(k))) throw new TypeError('DISPATCH_FIELDS');
  const {tenantId,eventId,action,loadId,loadVersion,principalId,principalActive,authorized,eligible,openExceptions,documentReady,approvalRecorded,confidence,estimatedCost,evidence}=context;
  if(![tenantId,eventId,loadId,principalId].every(safeId) || !ACTIONS.has(action) || !Number.isSafeInteger(loadVersion) || loadVersion<1) throw new TypeError('DISPATCH_IDENTITY');
  if(![principalActive,authorized,eligible,documentReady,approvalRecorded].every(v=>typeof v==='boolean') || !Number.isSafeInteger(openExceptions) || openExceptions<0) throw new TypeError('DISPATCH_EVIDENCE');
  if(principalActive!==true || authorized!==true) return block('AUTHORITY_DENIED',context);
  if(eligible!==true) return block('CAPACITY_INELIGIBLE',context);
  if(openExceptions!==0) return block('OPEN_EXCEPTION',context);
  if(action==='dispatch:assign' && documentReady!==true) return block('DOCUMENT_NOT_READY',context);
  const decision=evaluateDecision({tenantId,eventId,action,confidence,estimatedCost,evidence},policy);
  if(decision.status==='BLOCKED') return Object.freeze({...decision,executionReceipt:null});
  // Dispatch and exception recovery are always human governed, regardless of AI policy.
  if(action!=='capacity:recommend' || !approvalRecorded) return Object.freeze({...decision,status:'APPROVAL_REQUIRED',executionReceipt:null});
  return Object.freeze({...decision,status:decision.status==='ELIGIBLE_FOR_ORCHESTRATION'?'ELIGIBLE_FOR_ADVISORY':decision.status,executionReceipt:null});
}
