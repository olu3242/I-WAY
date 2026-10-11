import{validateCertification,sha256}from'./operations-certification.mjs';
const scenario=(id,steps,checks)=>Object.freeze({id,steps:Object.freeze(steps),checks:Object.freeze(checks)});
export const hostedScenarios=Object.freeze([
 scenario('identity',['authenticate approved fixture identity','verify MFA and server-owned tenant binding','revoke session and retry'],['verifiedMfa','tenantBound','revokedSessionDenied']),
 scenario('registration',['use separately approved consent and restricted registration login','create authorized synthetic registration','read back only its receipt'],['restrictedIdentity','approvedConsent','receiptPersisted']),
 scenario('persistence',['commit authorized synthetic operation','restart application connection','read back same operation'],['commitPersisted','restartReadMatched']),
 scenario('isolation',['read own synthetic tenant','attempt foreign tenant read and write','verify audit remains unchanged by rejected write'],['ownReadAllowed','foreignReadDenied','foreignWriteDenied','noForeignMutation']),
 scenario('workflow',['claim authorized synthetic queue item','renew lease','restart worker after expiry','reject stale completion'],['heartbeatPersisted','restartRecovered','staleFenceDenied','exactlyOneCompletion']),
 scenario('integrations',['deliver approved signed fixture','repeat the identical fixture','exercise failure and dead letter without real recipient delivery'],['signatureVerified','duplicateSuppressed','retryBounded','deadLetterVisible']),
 scenario('rollback',['validate previous artifact and trusted backup','rehearse rollback in isolated approved environment','verify health and audit continuity'],['artifactVerified','restoreIntegrity','healthPassed','auditContinuity'])
]);
export const hostedPrerequisites=Object.freeze(['explicitHostedTestAuthorization','restrictedPostgresAuthentication','approvedConsent','exposedCredentialRotation','approvedHostedIdentity','dedicatedOperationsPersistence','approvedIntegrationFixtures','approvedDeploymentAndRollback']);
export function validateScenarioReceipt(id,receipt){
 const definition=hostedScenarios.find(s=>s.id===id);
 if(!definition||!receipt||receipt.scenario!==id||!['isolated-fixture','hosted'].includes(receipt.scope)||!/^[a-f0-9]{64}$/.test(receipt.sourceHash??'')||!Number.isFinite(Date.parse(receipt.observedAt)))throw Error('SCENARIO_RECEIPT_INVALID');
 if(Object.keys(receipt.checks??{}).sort().join('|')!==[...definition.checks].sort().join('|')||definition.checks.some(k=>receipt.checks[k]!==true))throw Error('SCENARIO_ASSERTION_FAILED');
 return {scenario:id,scope:receipt.scope,assertions:definition.checks.length,status:'PASS'};
}
// No hosted transport is installed or accepted by this offline readiness command.
// Contract receipt checks never constitute proof that a deployment was exercised.
export function hostedReadiness(){
 return {schemaVersion:1,status:'BLOCKED',executed:false,networkCalls:0,reason:'Hosted authorization, credentials, consent and deployment evidence remain unresolved.',prerequisites:Object.fromEntries(hostedPrerequisites.map(k=>[k,'BLOCKED'])),scenarios:hostedScenarios.map(s=>({...s,status:'NOT_EXECUTED'}))};
}
const gate=(status,evidence,remaining)=>({status,evidence,remaining});
export function createReleaseAssessment(certification,options){
 validateCertification(certification,options);
 const local={sourceHash:certification.sourceHash,verify:certification.evidence.verify.logSha256,browser:certification.evidence.browser.logSha256};
 return {
  schemaVersion:1,generatedAt:certification.generatedAt,sourceHash:certification.sourceHash,certificationSha256:sha256(JSON.stringify(certification)),
  scope:'local evidence and offline production-readiness assessment',localDecision:'PARTIAL',hostedDecision:'NO-GO',deploymentExecuted:false,
  gates:{
   functionalCorrectness:gate('PASS',local.verify,'Local fixture behavior only.'),
   tenantIsolationAndAuthorization:gate('PARTIAL',local.verify,'PostgreSQL RLS execution and hosted identity remain unverified.'),
   workflowReliability:gate('PARTIAL',local.verify,'Independent local workers pass; hosted queue persistence remains unverified.'),
   accessibility:gate('PARTIAL',local.browser,'Manual WCAG 2.2 AA and assistive-technology assessment remain pending.'),
   performance:gate('PASS',certification.evidence.performance.artifact.sha256,'Measured local regression scenarios only; hosted SLO is not certified.'),
   aiGovernance:gate('PARTIAL',certification.evidence.evaluation.artifact.sha256,'Local policy/fallback contracts pass; approved model execution is blocked.'),
   credentialSecurity:gate('BLOCKED',null,'Restricted login authentication and exposed credential rotation require secure authorized verification.'),
   consentApproval:gate('BLOCKED',null,'No approved consent version is activated.'),
   hostedPersistence:gate('BLOCKED',null,'Offline migration and recording-pool contracts do not prove PostgreSQL execution or RLS.'),
   deploymentAndRollback:gate('BLOCKED',certification.evidence.recovery.artifact.sha256,'Local restore measured; authorized deployment and hosted rollback rehearsal are absent.')
  },
  hosted:hostedReadiness(),
  publicRelease:{referenceUrl:'http://localhost:4174/early-access.html',evidence:certification.evidence.publicTarget.logSha256,scope:'canonical entry fingerprint; full-site deployment acceptance is separate'},
  limitations:['Hashes bind local evidence; they are not independent signed attestations.','Contract assertions and successful local tests cannot promote a hosted gate.']
 };
}
export function validateReleaseAssessment(report,certification,options){
 const expected=createReleaseAssessment(certification,options);
 if(JSON.stringify(report)!==JSON.stringify(expected))throw Error('RELEASE_EVIDENCE_MISMATCH');
 return {valid:true,localDecision:report.localDecision,hostedDecision:report.hostedDecision,hostedExecuted:false};
}
