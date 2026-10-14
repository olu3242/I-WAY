import test from'node:test';import assert from'node:assert/strict';
import{hostedReadiness,hostedScenarios,validateScenarioReceipt,createReleaseAssessment,validateReleaseAssessment}from'../domain/operations-release.mjs';
import{createCertification,sha256,artifactNames,localGateNames}from'../domain/operations-certification.mjs';
function fixture(){
 const data={'verify.log':'# pass 134\n# fail 0\n# skipped 0\n','browser.log':'8 passed (20s)\n','performance.log':'local performance','recovery.log':'local recovery','evaluation.log':'local deterministic evaluation','publicTarget.log':'canonical entry matched'};
 const artifacts={'browser-evidence.json':{status:'passed',counts:{passed:8,failed:0,skipped:0},accessibility:{scanCount:1,violationCount:0,conformance:'manual_review_required'}},'performance.json':{status:'PASS'},'recovery.json':{status:'PASS',observedRpoMs:1,observedRtoMs:1,hostedCertified:false},'evaluation.json':{localStatus:'PASS',summary:{total:12,passed:12,failed:0,skipped:0,modelInferenceCount:0},modelEvaluation:{status:'BLOCKED'}}};
 for(const[k,v]of Object.entries(artifacts))data[k]=JSON.stringify(v);
 const evidence=Object.fromEntries(localGateNames.map(name=>[name,{exitCode:0,logFile:name+'.log',logSha256:sha256(data[name+'.log']),...(artifactNames[name]?{artifact:{file:artifactNames[name],sha256:sha256(data[artifactNames[name]])}}:{}),...(['verify','browser'].includes(name)?{counts:{passed:name==='verify'?134:8,failed:0,skipped:0}}:{})}]));
 return {cert:createCertification({sourceHash:'f'.repeat(64),baseCommit:'isolated-test-fixture',evidence}),options:{sourceHash:'f'.repeat(64),readArtifact:name=>Buffer.from(data[name])}};
}
test('hosted scenario plan stays blocked and requires every explicit evidence assertion',()=>{
 const plan=hostedReadiness();assert.equal(plan.status,'BLOCKED');assert.equal(plan.executed,false);assert.equal(plan.networkCalls,0);assert.equal(plan.scenarios.length,7);assert.ok(Object.values(plan.prerequisites).every(v=>v==='BLOCKED'));
 for(const s of hostedScenarios){
  const receipt={scenario:s.id,scope:'isolated-fixture',sourceHash:'a'.repeat(64),observedAt:new Date().toISOString(),checks:Object.fromEntries(s.checks.map(k=>[k,true]))};
  assert.equal(validateScenarioReceipt(s.id,receipt).scope,'isolated-fixture');
  for(const key of s.checks){assert.throws(()=>validateScenarioReceipt(s.id,{...receipt,checks:{...receipt.checks,[key]:false}}),/ASSERTION/);const missing={...receipt.checks};delete missing[key];assert.throws(()=>validateScenarioReceipt(s.id,{...receipt,checks:missing}),/ASSERTION/);}
  assert.throws(()=>validateScenarioReceipt(s.id,{...receipt,checks:{...receipt.checks,unsupported:true}}),/ASSERTION/);
 }
});
test('independent release gates reject stale evidence and cannot promote local success to hosted GO',()=>{
 const {cert,options}=fixture(),report=createReleaseAssessment(cert,options);
 assert.deepEqual(validateReleaseAssessment(report,cert,options),{valid:true,localDecision:'PARTIAL',hostedDecision:'NO-GO',hostedExecuted:false});assert.equal(Object.keys(report.gates).length,10);
 for(const key of Object.keys(report.gates)){const changed=structuredClone(report);changed.gates[key].status='GO';assert.throws(()=>validateReleaseAssessment(changed,cert,options),/MISMATCH/);}
 for(const patch of [{hostedDecision:'GO'},{localDecision:'GO'},{deploymentExecuted:true}])assert.throws(()=>validateReleaseAssessment({...report,...patch},cert,options),/MISMATCH/);
 assert.throws(()=>createReleaseAssessment(cert,{...options,sourceHash:'b'.repeat(64)}),/STALE_SOURCE/);
 assert.throws(()=>createReleaseAssessment(cert,{...options,readArtifact:()=>Buffer.from('changed')}),/CHANGED/);
});
