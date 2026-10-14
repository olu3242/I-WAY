import test from'node:test';import assert from'node:assert/strict';import{createCertification,validateCertification,sha256,localGateNames,artifactNames}from'../domain/operations-certification.mjs';
function proof(){const logs={verify:'# pass 134\n# fail 0\n# skipped 0\n',browser:'8 passed (20s)\n',performance:'actual scenario passed',recovery:'actual restore passed',evaluation:'offline local evaluation passed',publicTarget:'canonical entry matched'};
 const artifacts={'browser-evidence.json':{status:'passed',counts:{passed:8,failed:0,skipped:0},accessibility:{scanCount:1,violationCount:0,conformance:'manual_review_required'}},'performance.json':{status:'PASS'},'recovery.json':{status:'PASS',observedRpoMs:1,observedRtoMs:1,hostedCertified:false},'evaluation.json':{localStatus:'PASS',summary:{total:12,passed:12,failed:0,skipped:0,modelInferenceCount:0},modelEvaluation:{status:'BLOCKED'}}};
 const evidence=Object.fromEntries(localGateNames.map(name=>[name,{exitCode:0,logFile:name+'.log',logSha256:sha256(logs[name]),...(artifactNames[name]?{artifact:{file:artifactNames[name],sha256:sha256(JSON.stringify(artifacts[artifactNames[name]]))}}:{}),...(['verify','browser'].includes(name)?{counts:{passed:name==='verify'?134:8,failed:0,skipped:0}}:{})}]));
 return {logs,manifest:createCertification({sourceHash:'a'.repeat(64),baseCommit:'illustrative',evidence}),options:{sourceHash:'a'.repeat(64),readArtifact:name=>Buffer.from(name.endsWith('.json')?JSON.stringify(artifacts[name]):logs[name.replace('.log','')])}};
}
test('local evidence manifest binds sources and logs while remaining independent of blocked hosted gates',()=>{
 const {manifest,options}=proof();assert.deepEqual(validateCertification(manifest,options),{valid:true,localDecision:'PARTIAL',hostedDecision:'NO-GO'});
 for(const patch of [{sourceHash:'b'.repeat(64)},{hostedDecision:'GO'},{localDecision:'GO'},{manualGates:{wcag22AAManual:'PASS'}}])assert.throws(()=>validateCertification({...manifest,...patch},options));
 const changed=structuredClone(manifest);changed.evidence.verify.counts.passed=200;assert.throws(()=>validateCertification(changed,options),/TEST_GATE/);
 assert.throws(()=>validateCertification(manifest,{...options,readArtifact:()=>Buffer.from('tampered')}),/EVIDENCE_CHANGED/);
});
test('missing or failed local evidence cannot issue a local or hosted GO',()=>{
 const {manifest,options}=proof();delete manifest.evidence.recovery;assert.throws(()=>validateCertification(manifest,options),/MISSING/);
 const {manifest:m,options:o}=proof();m.evidence.recovery.exitCode=1;assert.throws(()=>validateCertification(m,o));
});

test('certification rejects deleted, altered or re-labelled measurement and accessibility artifacts',()=>{
 const {manifest,options}=proof();
 assert.throws(()=>validateCertification(manifest,{...options,readArtifact:name=>name==='evaluation.json'?Buffer.from('{}'):options.readArtifact(name)}),/ARTIFACT_CHANGED/);
 const missing=structuredClone(manifest);delete missing.evidence.recovery.artifact;assert.throws(()=>validateCertification(missing,options),/ARTIFACT_MISSING/);
 const altered=structuredClone(manifest);altered.evidence.performance.artifact.file='../another-file';assert.throws(()=>validateCertification(altered,options),/ARTIFACT_MISSING/);
});
