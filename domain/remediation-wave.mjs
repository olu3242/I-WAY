// B245-B255: offline evidence intake and release-boundary assessment.
// Never connects to a host, loads credentials, or authorizes execution.
import {createHash} from 'node:crypto';
import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {assessHostedPrerequisites} from './hosted-prerequisite-assessment.mjs';

export const remediationBatches=Object.freeze({
 B245:{name:'restricted database authentication',prerequisites:['restrictedPostgresAuthentication'],scenario:'persistence'},
 B246:{name:'versioned consent activation',prerequisites:['approvedConsent'],scenario:'registration'},
 B247:{name:'identity MFA and session revocation',prerequisites:['approvedHostedIdentity'],scenario:'identity'},
 B248:{name:'hosted persistence and RLS',prerequisites:['dedicatedOperationsPersistence'],scenario:'isolation'},
 B249:{name:'queue lease recovery and fencing',prerequisites:['dedicatedOperationsPersistence'],scenario:'workflow'},
 B250:{name:'signed integration replay and dead letters',prerequisites:['approvedIntegrationFixtures'],scenario:'integrations'},
 B251:{name:'AI provider governance',prerequisites:['explicitHostedTestAuthorization'],scenario:null},
 B252:{name:'deployment backup and rollback',prerequisites:['approvedDeploymentAndRollback'],scenario:'rollback'},
 B253:{name:'aggregate release evidence integrity',prerequisites:['explicitHostedTestAuthorization'],scenario:null},
 B254:{name:'credential rotation attestation',prerequisites:['exposedCredentialRotation'],scenario:null},
 B255:{name:'final go no-go decision',prerequisites:hostedPrerequisites,scenario:null}
});
const hash=/^[a-f0-9]{64}$/;
const keys=Object.keys(remediationBatches);
const scenarioById=new Map(hostedScenarios.map(s=>[s.id,s]));
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function validDate(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function validateEvidence(batch,item,sourceHash){
 if(!plain(item))return {status:'BLOCKED',reason:'EVIDENCE_MISSING'};
 const allowed=['batch','sourceHash','artifactSha256','observedAt','scope','checks'];
 if(Object.keys(item).some(k=>!allowed.includes(k)))return {status:'BLOCKED',reason:'UNEXPECTED_FIELDS'};
 if(item.batch!==batch||item.sourceHash!==sourceHash||!hash.test(item.artifactSha256??'')||!validDate(item.observedAt)||item.scope!=='isolated-fixture')return {status:'BLOCKED',reason:'INVALID_OR_UNTRUSTED_EVIDENCE'};
 const scenario=scenarioById.get(remediationBatches[batch].scenario);
 if(scenario){
  if(!plain(item.checks)||Object.keys(item.checks).sort().join('|')!==[...scenario.checks].sort().join('|')||scenario.checks.some(k=>item.checks[k]!==true))return {status:'BLOCKED',reason:'SCENARIO_ASSERTIONS_INCOMPLETE'};
 }else if(!plain(item.checks)||Object.keys(item.checks).length!==0)return {status:'BLOCKED',reason:'UNEXPECTED_ASSERTIONS'};
 return {status:'LOCAL_FIXTURE_RECORDED',artifactSha256:item.artifactSha256};
}
export function assessRemediationWave({sourceHash,prerequisites={},evidence={}}={}){
 if(!hash.test(sourceHash??''))throw Error('SOURCE_HASH_REQUIRED');
 if(!plain(evidence)||Object.keys(evidence).some(k=>!keys.includes(k)))throw Error('INVALID_BATCH_EVIDENCE');
 const approvals=assessHostedPrerequisites(prerequisites);
 const batches=Object.fromEntries(keys.map(key=>[key,validateEvidence(key,evidence[key],sourceHash)]));
 const canonical=JSON.stringify({sourceHash,prerequisites:approvals.prerequisites,batches});
 return {
  schemaVersion:1,scope:'offline-local-fixture-only',sourceHash,
  evidenceDigest:createHash('sha256').update(canonical).digest('hex'),
  batches,prerequisites:approvals.prerequisites,
  localDecision:'PARTIAL',hostedDecision:'NO-GO',
  hostedExecuted:false,networkCalls:0,deploymentExecuted:false,executionAuthorized:false,
  limitations:['Evidence metadata is not independent attestation.','Fixture checks do not establish hosted execution or production readiness.']
 };
}
