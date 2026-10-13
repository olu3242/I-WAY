// B241-B242: bounded, non-executing operational classification.
// No tenant identifiers, payloads, credentials or raw error messages in telemetry.
import {createHash} from 'node:crypto';
const allowed=new Set(['eligible','blocked','approval_required','retryable_failure','terminal_failure','completed']);
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const categories=new Set(['TIMEOUT','RATE_LIMIT','TRANSIENT_UNAVAILABLE','AUTHORITY_DENIED','STALE_VERSION','POLICY_DENIED','INVALID_EVIDENCE','NONE']);
const retryable=new Set(['TIMEOUT','RATE_LIMIT','TRANSIENT_UNAVAILABLE']);
export function classifyOperationalOutcome(input){
 if(!input || typeof input!=='object' || Array.isArray(input))throw new TypeError('OUTCOME_INPUT');
 const keys=['tenantId','eventId','attempt','state','failureCategory','maxAttempts','resourceVersion'];
 if(Object.keys(input).some(k=>!keys.includes(k)))throw new TypeError('OUTCOME_FIELDS');
 const {tenantId,eventId,attempt,state,failureCategory,maxAttempts,resourceVersion}=input;
 if(![tenantId,eventId].every(v=>typeof v==='string'&&ID.test(v)))throw new TypeError('OUTCOME_ID');
 if(!allowed.has(state)||!categories.has(failureCategory)||![attempt,maxAttempts,resourceVersion].every(Number.isSafeInteger)||attempt<1||maxAttempts<1||maxAttempts>10||attempt>maxAttempts||resourceVersion<1)throw new TypeError('OUTCOME_STATE');
 const failed=state==='retryable_failure'||state==='terminal_failure';
 if(failed===(failureCategory==='NONE'))throw new TypeError('OUTCOME_CATEGORY');
 if(state==='retryable_failure'&&!retryable.has(failureCategory))throw new TypeError('OUTCOME_RETRY_CLASS');
 const canRetry=state==='retryable_failure'&&attempt<maxAttempts;
 const next=canRetry?'RETRY_SCHEDULE_REQUIRED':failed?'DEAD_LETTER_REVIEW_REQUIRED':state==='approval_required'?'HUMAN_APPROVAL_REQUIRED':'NO_AUTOMATED_ACTION';
 const correlation=createHash('sha256').update(JSON.stringify([tenantId,eventId,resourceVersion])).digest('hex').slice(0,20);
 return Object.freeze({state,category:failureCategory,attempt,maxAttempts,correlation,disposition:next,retryPermitted:canRetry,externalDelivery:false,executionReceipt:null});
}
