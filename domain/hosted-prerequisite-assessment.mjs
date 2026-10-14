// Offline-only prerequisite assessment. Never accepts secrets or connects to a host.
import {hostedPrerequisites} from './operations-release.mjs';

const forbidden=/password|secret|token|private.key|database.url|connection.string|api.key|credential.value/i;
const digest=/^[a-f0-9]{64}$/;
const allowed=new Set(['verified','blocked']);
export function assessHostedPrerequisites(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_PREREQUISITES');
 if(Object.keys(input).some(k=>!hostedPrerequisites.includes(k)))throw Error('UNKNOWN_PREREQUISITE');
 const prerequisites={};
 for(const key of hostedPrerequisites){
  const item=input[key];
  if(item===undefined){prerequisites[key]={status:'BLOCKED',reason:'EVIDENCE_MISSING'};continue;}
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['status','evidenceSha256','approvedBy','approvedAt'].includes(k)))throw Error('INVALID_PREREQUISITE_EVIDENCE');
  if(Object.values(item).some(v=>typeof v==='string'&&forbidden.test(v)))throw Error('SENSITIVE_EVIDENCE_REJECTED');
  if(!allowed.has(item.status))throw Error('INVALID_PREREQUISITE_STATUS');
  const verified=item.status==='verified'&&digest.test(item.evidenceSha256??'')&&typeof item.approvedBy==='string'&&item.approvedBy.trim().length>0&&Number.isFinite(Date.parse(item.approvedAt??''));
  prerequisites[key]=verified?{status:'EVIDENCE_RECORDED',evidenceSha256:item.evidenceSha256}:{status:'BLOCKED',reason:'APPROVAL_OR_EVIDENCE_MISSING'};
 }
 // Recorded metadata is not independent attestation or permission to run hosted tests.
 return {schemaVersion:1,scope:'offline-metadata-only',networkCalls:0,hostedExecuted:false,executionAuthorized:false,status:'BLOCKED',prerequisites};
}
