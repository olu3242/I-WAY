// Offline hosted-readiness preflight. No network, secrets, hosted execution, or authorization.
import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {sha256} from './operations-certification.mjs';
const digest=/^[a-f0-9]{64}$/;
const stages=Object.freeze([
  {id:'infrastructure',needs:['explicitHostedTestAuthorization','restrictedPostgresAuthentication','approvedHostedIdentity']},
  {id:'identity-and-isolation',needs:['restrictedPostgresAuthentication','approvedHostedIdentity','dedicatedOperationsPersistence']},
  {id:'four-app-workflows',needs:['approvedConsent','dedicatedOperationsPersistence','approvedIntegrationFixtures']},
  {id:'operational-reliability',needs:['approvedDeploymentAndRollback','approvedIntegrationFixtures']},
  {id:'release-governance',needs:['explicitHostedTestAuthorization','approvedConsent','exposedCredentialRotation','approvedDeploymentAndRollback']}
]);
export function createHostedPreflight({sourceHash,records={}}){
 if(!digest.test(sourceHash??''))throw Error('PREFLIGHT_SOURCE_INVALID');
 if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).some(k=>!hostedPrerequisites.includes(k)))throw Error('PREFLIGHT_RECORDS_INVALID');
 const prerequisites={};
 for(const key of hostedPrerequisites){
  const r=records[key];
  if(r===undefined){prerequisites[key]={status:'MISSING'};continue;}
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['sourceHash','evidenceSha256','reviewerId','reviewedAt','decision'].includes(k))||
    r.sourceHash!==sourceHash||!digest.test(r.evidenceSha256??'')||!/^[-a-zA-Z0-9_.]{2,80}$/.test(r.reviewerId??'')||
    typeof r.reviewedAt!=='string'||!Number.isFinite(Date.parse(r.reviewedAt))||!['APPROVED','REJECTED'].includes(r.decision))
   throw Error('PREFLIGHT_RECORD_INVALID');
  prerequisites[key]={status:r.decision==='APPROVED'?'REVIEW_RECORDED':'REJECTED',evidenceSha256:r.evidenceSha256};
 }
 const phases=stages.map(stage=>({id:stage.id,status:'BLOCKED',missing:stage.needs.filter(k=>prerequisites[k].status!=='REVIEW_RECORDED'),execution:'NOT_EXECUTED'}));
 return {schemaVersion:1,sourceHash,scope:'offline-readiness-only',prerequisites,phases,
  scenarios:hostedScenarios.map(s=>({id:s.id,status:'NOT_EXECUTED',requiredAssertions:[...s.checks]})),
  evidenceDigest:sha256(JSON.stringify(prerequisites)),networkCalls:0,hostedExecuted:false,executionAuthorized:false,
  productionWrites:0,decision:'NO-GO'};
}
export function validateHostedPreflight(report,options){
 if(JSON.stringify(report)!==JSON.stringify(createHostedPreflight(options)))throw Error('PREFLIGHT_EVIDENCE_MISMATCH');
 return {valid:true,decision:'NO-GO',hostedExecuted:false,blockedPhases:report.phases.length};
}
