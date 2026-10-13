import {hostedPrerequisites,hostedScenarios} from './operations-release.mjs';
import {assessHostedPrerequisites} from './hosted-prerequisite-assessment.mjs';

// B266-B275: offline planning only. Approval metadata never grants execution.
export function createHostedCertificationMatrix(input={}){
 const assessed=assessHostedPrerequisites(input);
 return {
  schemaVersion:1,
  scope:'offline-hosted-readiness-plan',
  networkCalls:0,
  hostedExecuted:false,
  executionAuthorized:false,
  decision:'NO-GO',
  prerequisites:assessed.prerequisites,
  scenarios:hostedScenarios.map(s=>({
   id:s.id,
   status:'NOT_EXECUTED',
   requiredAssertions:[...s.checks],
   evidenceStatus:'MISSING'
  })),
  unresolved:hostedPrerequisites.filter(k=>assessed.prerequisites[k].status!=='EVIDENCE_RECORDED'),
  limitations:['Recorded approval metadata is not authorization to connect.','No hosted scenario can PASS without independently verified execution.']
 };
}
export function validateHostedCertificationMatrix(report,input={}){
 const expected=createHostedCertificationMatrix(input);
 if(JSON.stringify(report)!==JSON.stringify(expected))throw Error('HOSTED_MATRIX_INVALID');
 return {valid:true,decision:'NO-GO',hostedExecuted:false};
}
