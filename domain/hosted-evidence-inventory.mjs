import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {sha256} from './operations-certification.mjs';

// B276-B285: strict, non-executable prerequisite and execution evidence inventory.
// No network operations, secrets, or authority elevation.
const hex=/^[a-f0-9]{64}$/;
export function assessHostedEvidenceInventory({sourceHash,records={}}){
 if(!hex.test(sourceHash))throw Error('INVENTORY_SOURCE_INVALID');
 if(!records||typeof records!=='object'||Array.isArray(records))throw Error('INVENTORY_INVALID');
 if(Object.keys(records).some(k=>!hostedPrerequisites.includes(k)))throw Error('INVENTORY_UNKNOWN_KEY');
 const prerequisites={};
 for(const key of hostedPrerequisites){
  const entry=records[key];
  if(entry===undefined){prerequisites[key]={status:'MISSING'};continue;}
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(k=>!['sourceHash','evidenceSha256','reviewerId','reviewedAt','decision'].includes(k)))throw Error('INVENTORY_ENTRY_INVALID');
  if(entry.sourceHash!==sourceHash||!hex.test(entry.evidenceSha256)||typeof entry.reviewerId!=='string'||!/^[-a-zA-Z0-9_.]{2,80}$/.test(entry.reviewerId)||!Number.isFinite(Date.parse(entry.reviewedAt??''))||!['APPROVED','REJECTED'].includes(entry.decision))throw Error('INVENTORY_ENTRY_INVALID');
  prerequisites[key]={status:entry.decision==='APPROVED'?'REVIEW_RECORDED':'REJECTED',evidenceSha256:entry.evidenceSha256};
 }
 return {schemaVersion:1,sourceHash,scope:'offline-review-metadata',prerequisites,
  scenarios:hostedScenarios.map(s=>({id:s.id,status:'NOT_EXECUTED',requiredAssertions:[...s.checks]})),
  missing:hostedPrerequisites.filter(k=>prerequisites[k].status!=='REVIEW_RECORDED'),
  digest:sha256(JSON.stringify(prerequisites)),networkCalls:0,hostedExecuted:false,executionAuthorized:false,decision:'NO-GO'};
}
export function validateHostedEvidenceInventory(report,options){
 const expected=assessHostedEvidenceInventory(options);
 if(JSON.stringify(report)!==JSON.stringify(expected))throw Error('INVENTORY_MISMATCH');
 return {valid:true,decision:'NO-GO',hostedExecuted:false,missing:report.missing.length};
}
