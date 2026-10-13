// B296-B305: non-production fixture preparation. No network, database or credentials.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const slug=/^[a-z][a-z0-9-]{2,39}$/;
const sha=/^[a-f0-9]{64}$/;
const keys=['environment','sourceHash','operator','consentVersion','consentApproved','restrictedIdentityReviewed','rotationEvidenceReviewed','rollbackPlanReviewed','syntheticFixtureApproved','authorizationReviewed'];
export function prepareHostedSandbox(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k)))throw Error('SANDBOX_INPUT_INVALID');
 if(input.environment!=='non-production'||!sha.test(input.sourceHash??'')||!slug.test(input.operator??''))throw Error('SANDBOX_SCOPE_INVALID');
 const consent=typeof input.consentVersion==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$/.test(input.consentVersion);
 const approvals=['consentApproved','restrictedIdentityReviewed','rotationEvidenceReviewed','rollbackPlanReviewed','syntheticFixtureApproved','authorizationReviewed'];
 if(approvals.some(k=>typeof input[k]!=='boolean'))throw Error('SANDBOX_APPROVAL_INVALID');
 const requirements={approvedConsent:consent&&input.consentApproved,restrictedIdentity:input.restrictedIdentityReviewed,credentialRotation:input.rotationEvidenceReviewed,rollback:input.rollbackPlanReviewed,fixtures:input.syntheticFixtureApproved,authorization:input.authorizationReviewed};
 const fixtures=['identity','registration','persistence','isolation','workflow','integrations','rollback'].map((name,i)=>({
  id:name,syntheticTenant:'sandbox-tenant-'+String(i+1).padStart(2,'0'),
  syntheticCaseId:hash(input.sourceHash+':'+name).slice(0,20),status:'PREPARED_NOT_EXECUTED'
 }));
 return {schemaVersion:1,scope:'non-production-offline-only',sourceHash:input.sourceHash,operator:input.operator,
  consentVersion:consent?input.consentVersion:null,requirements,missing:Object.keys(requirements).filter(k=>!requirements[k]),
  fixtures,networkCalls:0,hostedExecuted:false,executionAuthorized:false,productionWrites:0,customerNotifications:0,decision:'NO-GO'};
}
export function validateHostedSandbox(report,input){
 if(JSON.stringify(report)!==JSON.stringify(prepareHostedSandbox(input)))throw Error('SANDBOX_REPORT_CHANGED');
 return {valid:true,decision:'NO-GO',hostedExecuted:false};
}
