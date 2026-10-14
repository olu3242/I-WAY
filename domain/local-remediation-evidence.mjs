// Derive local execution evidence from independently captured certification artifacts.
// This is NOT a hosted scenario receipt and never asserts hosted checks as true.
import {sha256,validateCertification} from './operations-certification.mjs';
import {remediationBatches} from './remediation-wave.mjs';
const mapping=Object.freeze({
 B245:['verify'],B246:['verify'],B247:['verify','browser'],B248:['verify'],
 B249:['verify'],B250:['verify'],B251:['evaluation','verify'],
 B252:['recovery'],B253:['verify','browser','performance','recovery','evaluation','publicTarget'],
 B254:[],B255:['verify','browser','performance','recovery','evaluation','publicTarget']
});
export function deriveLocalRemediationEvidence(certification,{sourceHash,readArtifact}){
 validateCertification(certification,{sourceHash,readArtifact});
 const batches={};
 for(const [id,definition] of Object.entries(remediationBatches)){
  const gates=mapping[id];
  const artifacts=gates.map(g=>{
   const e=certification.evidence[g];
   const raw=readArtifact(e.logFile);
   if(sha256(raw)!==e.logSha256)throw Error('LOCAL_EVIDENCE_CHANGED');
   return {gate:g,logSha256:e.logSha256,...(e.artifact?{artifactSha256:e.artifact.sha256}:{})};
  });
  batches[id]={capability:definition.name,status:gates.length?'LOCAL_GATE_EVIDENCE_ONLY':'BLOCKED',
   hostedScenario:definition.scenario??null,hostedExecuted:false,checksVerified:false,
   remaining:gates.length?'Scenario-specific checks require independently executed assertions.':'No local execution evidence mapped.',
   artifacts};
 }
 return {schemaVersion:1,sourceHash,scope:'validated-local-gate-evidence',
  localDecision:'PARTIAL',hostedDecision:'NO-GO',hostedExecuted:false,executionAuthorized:false,batches};
}
export function validateLocalRemediationEvidence(report,certification,options){
 const expected=deriveLocalRemediationEvidence(certification,options);
 if(JSON.stringify(report)!==JSON.stringify(expected))throw Error('LOCAL_REMEDIATION_EVIDENCE_MISMATCH');
 return {valid:true,localDecision:'PARTIAL',hostedDecision:'NO-GO',hostedExecuted:false};
}
