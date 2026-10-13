// Local execution evidence integrity. Hashes are not independent attestations.
import {sha256} from './operations-certification.mjs';
const ids=['identity','persistence-isolation-workflow','integrations'];
const tap=log=>{
 const find=key=>{const m=log.match(new RegExp('(?:^|\\n)(?:#|ℹ)\\s*'+key+'\\s+(\\d+)(?:\\r?\\n|$)'));return m?Number(m[1]):null};
 return {tests:find('tests'),pass:find('pass'),fail:find('fail'),skipped:find('skipped'),cancelled:find('cancelled')};
};
export function validateIsolatedScenarioEvidence(report,{sourceHash,readLog}){
 if(!report||report.schemaVersion!==1||report.sourceHash!==sourceHash||report.scope!=='isolated-local'||report.hostedExecuted!==false||report.hostedDecision!=='NO-GO'||!Array.isArray(report.scenarios)||report.scenarios.length!==ids.length)throw Error('SCENARIO_MANIFEST_INVALID');
 for(let i=0;i<ids.length;i++){
  const item=report.scenarios[i];
  if(item?.id!==ids[i])throw Error('SCENARIO_MANIFEST_INVALID');
  if(i!==1){
   if(JSON.stringify(item)!==JSON.stringify({id:ids[i],status:'NOT_EXECUTED',logFile:null}))throw Error('SCENARIO_MANIFEST_INVALID');
   continue;
  }
  if(item.logFile!=='persistence-isolation-workflow.log'||!['PASS','FAIL'].includes(item.status)||!Number.isInteger(item.exitCode)||item.status!==(item.exitCode===0?'PASS':'FAIL')||!/^[a-f0-9]{64}$/.test(item.logSha256??''))throw Error('SCENARIO_MANIFEST_INVALID');
  const raw=readLog(item.logFile);
  if(sha256(raw)!==item.logSha256)throw Error('SCENARIO_LOG_CHANGED');
  const counts=tap(raw.toString());
  if(counts.tests===null||counts.tests<1||counts.pass===null||counts.fail===null||counts.skipped===null||counts.cancelled===null||counts.tests!==counts.pass+counts.fail+counts.skipped+counts.cancelled||item.status==='PASS'&&(counts.fail!==0||counts.skipped!==0||counts.cancelled!==0||counts.pass!==counts.tests))throw Error('SCENARIO_ASSERTIONS_INCOMPLETE');
 }
 return {valid:true,localStatus:report.scenarios[1].status==='PASS'?'PARTIAL':'FAIL',hostedDecision:'NO-GO'};
}
