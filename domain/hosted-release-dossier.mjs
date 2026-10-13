import {createHostedCertificationMatrix,validateHostedCertificationMatrix} from './hosted-certification-matrix.mjs';
import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {sha256} from './operations-certification.mjs';

// B270-B275 offline release evidence. No network, credentials, or hosted execution.
export function createHostedReleaseDossier({sourceHash,localScenarioStatus,prerequisites={}}){
 if(!/^[a-f0-9]{64}$/.test(sourceHash))throw Error('HOSTED_SOURCE_INVALID');
 if(!['PASS','FAIL','NOT_EXECUTED'].includes(localScenarioStatus))throw Error('LOCAL_SCENARIO_INVALID');
 const matrix=createHostedCertificationMatrix(prerequisites);
 const checks=hostedScenarios.map(s=>({id:s.id,status:'NOT_EXECUTED',requiredAssertions:[...s.checks],receipt:'MISSING'}));
 const preflight={status:'BLOCKED',reason:'INDEPENDENT_HOSTED_AUTHORIZATION_REQUIRED',sourceHash,restrictedIdentity:'UNVERIFIED',approvedConsent:'UNVERIFIED',integrationFixtures:'UNVERIFIED'};
 const rollback={status:'NOT_EXECUTED',artifactIntegrity:'UNVERIFIED',restoreIntegrity:'UNVERIFIED',auditContinuity:'UNVERIFIED'};
 return {schemaVersion:1,sourceHash,scope:'offline-hosted-readiness',localScenarioStatus,matrix,checks,preflight,rollback,
  prerequisiteDigest:sha256(JSON.stringify(matrix.prerequisites)),
  hostedExecuted:false,executionAuthorized:false,decision:'NO-GO',
  unresolvedPrerequisites:hostedPrerequisites.filter(k=>matrix.prerequisites[k].status!=='EVIDENCE_RECORDED')};
}
export function validateHostedReleaseDossier(report,options){
 const expected=createHostedReleaseDossier(options);
 validateHostedCertificationMatrix(report?.matrix,options.prerequisites??{});
 if(JSON.stringify(report)!==JSON.stringify(expected))throw Error('HOSTED_DOSSIER_MISMATCH');
 return {valid:true,hostedDecision:'NO-GO',hostedExecuted:false,unresolved:report.unresolvedPrerequisites.length};
}
