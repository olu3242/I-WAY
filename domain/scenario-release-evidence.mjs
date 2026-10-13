import {validateIsolatedScenarioEvidence} from './isolated-scenario-evidence.mjs';
import {sha256} from './operations-certification.mjs';
export function assessScenarioRelease(sourceHash,readArtifact){
 let raw;
 try{raw=readArtifact('isolated-scenarios.json');}catch(e){if(e.code==='ENOENT')return {status:'NOT_EXECUTED',hostedDecision:'NO-GO',hostedExecuted:false};throw e;}
 const data=JSON.parse(raw.toString());
 const verdict=validateIsolatedScenarioEvidence(data,{sourceHash,readLog:readArtifact});
 return {status:verdict.localStatus,sha256:sha256(raw),hostedDecision:'NO-GO',hostedExecuted:false};
}
