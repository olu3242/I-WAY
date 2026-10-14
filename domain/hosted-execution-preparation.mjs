import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {sha256} from './operations-certification.mjs';

// B286-B295: explicit offline operator preparation, never a hosted execution permit.
const digest=/^[a-f0-9]{64}$/;
const id=/^[a-zA-Z0-9_.-]{2,80}$/;
export function createHostedExecutionPreparation({sourceHash,approvals={}}){
 if(!digest.test(sourceHash))throw Error('PREPARATION_SOURCE_INVALID');
 if(!approvals||typeof approvals!=='object'||Array.isArray(approvals)||Object.keys(approvals).some(k=>!hostedPrerequisites.includes(k)))throw Error('PREPARATION_APPROVALS_INVALID');
 const prerequisites={};
 for(const key of hostedPrerequisites){
  const record=approvals[key];
  if(record===undefined){prerequisites[key]={status:'MISSING'};continue;}
  if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).some(k=>!['sourceHash','evidenceSha256','reviewerId','reviewedAt','decision'].includes(k))||record.sourceHash!==sourceHash||!digest.test(record.evidenceSha256)||!id.test(record.reviewerId)||!Number.isFinite(Date.parse(record.reviewedAt??''))||!['APPROVED','REJECTED'].includes(record.decision))throw Error('PREPARATION_RECORD_INVALID');
  prerequisites[key]={status:record.decision==='APPROVED'?'REVIEW_RECORDED':'REJECTED',evidenceSha256:record.evidenceSha256};
 }
 const scenarios=hostedScenarios.map(s=>({id:s.id,status:'NOT_EXECUTED',assertions:[...s.checks],syntheticFixture:'REQUIRES_APPROVAL',evidence:'NOT_COLLECTED'}));
 return {schemaVersion:1,sourceHash,scope:'offline-preparation',prerequisites,scenarios,
  stages:['independent authorization review','restricted identity and tenant binding verification','approved consent and synthetic fixtures','controlled persistence and isolation tests','workflow and integration tests','isolated rollback rehearsal','independent evidence review'],
  reviewDigest:sha256(JSON.stringify(prerequisites)),missing:hostedPrerequisites.filter(k=>prerequisites[k].status!=='REVIEW_RECORDED'),
  hostedExecuted:false,networkCalls:0,executionAuthorized:false,decision:'NO-GO'};
}
export function validateHostedExecutionPreparation(report,options){
 if(JSON.stringify(report)!==JSON.stringify(createHostedExecutionPreparation(options)))throw Error('PREPARATION_MISMATCH');
 return {valid:true,hostedDecision:'NO-GO',hostedExecuted:false};
}
