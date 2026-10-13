// B267-B276: offline intake of reviewer metadata, not proof of hosted execution.
import {hostedPrerequisites} from './operations-release.mjs';
import {createHostedPreflight} from './hosted-readiness-preflight.mjs';
import {sha256} from './operations-certification.mjs';
const digest=/^[a-f0-9]{64}$/;
const reviewer=/^[-a-zA-Z0-9_.]{2,80}$/;
const allowed=['sourceHash','evidenceSha256','reviewerId','reviewedAt','decision'];
export function assessHostedEvidenceIntake({sourceHash,records={}}){
 if(!digest.test(sourceHash??''))throw Error('INTAKE_SOURCE_INVALID');
 if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).some(k=>!hostedPrerequisites.includes(k)))throw Error('INTAKE_KEYS_INVALID');
 const normalized={};
 for(const key of hostedPrerequisites){
  const r=records[key];
  if(r===undefined){normalized[key]={status:'MISSING'};continue;}
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!allowed.includes(k))||
   r.sourceHash!==sourceHash||!digest.test(r.evidenceSha256??'')||!reviewer.test(r.reviewerId??'')||
   typeof r.reviewedAt!=='string'||!Number.isFinite(Date.parse(r.reviewedAt))||
   !['APPROVED','REJECTED'].includes(r.decision))throw Error('INTAKE_RECORD_INVALID');
  normalized[key]={status:r.decision==='APPROVED'?'REVIEW_METADATA_SUBMITTED':'REJECTED',evidenceSha256:r.evidenceSha256};
 }
 // The preflight's review-recorded state is not used: metadata cannot grant authorization.
 const preflight=createHostedPreflight({sourceHash});
 return {schemaVersion:1,sourceHash,scope:'offline-review-intake',prerequisites:normalized,
  missing:hostedPrerequisites.filter(k=>normalized[k].status==='MISSING'),
  rejected:hostedPrerequisites.filter(k=>normalized[k].status==='REJECTED'),
  pendingIndependentVerification:hostedPrerequisites.filter(k=>normalized[k].status==='REVIEW_METADATA_SUBMITTED'),
  phases:preflight.phases.map(p=>({...p})),scenarios:preflight.scenarios,
  intakeDigest:sha256(JSON.stringify(normalized)),networkCalls:0,hostedExecuted:false,
  executionAuthorized:false,productionWrites:0,decision:'NO-GO'};
}
export function validateHostedEvidenceIntake(report,options){
 if(JSON.stringify(report)!==JSON.stringify(assessHostedEvidenceIntake(options)))throw Error('INTAKE_EVIDENCE_CHANGED');
 return {valid:true,decision:'NO-GO',hostedExecuted:false,submitted:report.pendingIndependentVerification.length};
}
