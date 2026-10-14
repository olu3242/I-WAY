import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveLocalRemediationEvidence,validateLocalRemediationEvidence} from '../domain/local-remediation-evidence.mjs';
import {createCertification,sha256,localGateNames,artifactNames} from '../domain/operations-certification.mjs';
const data={'verify.log':'# pass 134\n# fail 0\n# skipped 0\n','browser.log':'8 passed (20s)\n','performance.log':'local performance','recovery.log':'local recovery','evaluation.log':'local evaluation','publicTarget.log':'site checked'};
const artifacts={'browser-evidence.json':{status:'passed',counts:{passed:8,failed:0,skipped:0},accessibility:{scanCount:1,violationCount:0,conformance:'manual_review_required'}},'performance.json':{status:'PASS'},'recovery.json':{status:'PASS',observedRpoMs:1,observedRtoMs:1,hostedCertified:false},'evaluation.json':{localStatus:'PASS',summary:{total:12,passed:12,failed:0,skipped:0,modelInferenceCount:0},modelEvaluation:{status:'BLOCKED'}}};
for(const [k,v] of Object.entries(artifacts))data[k]=JSON.stringify(v);
const evidence=Object.fromEntries(localGateNames.map(name=>[name,{exitCode:0,logFile:name+'.log',logSha256:sha256(data[name+'.log']),...(artifactNames[name]?{artifact:{file:artifactNames[name],sha256:sha256(data[artifactNames[name]])}}:{}),...(['verify','browser'].includes(name)?{counts:{passed:name==='verify'?134:8,failed:0,skipped:0}}:{})}]));
const sourceHash='f'.repeat(64),cert=createCertification({sourceHash,baseCommit:'fixture',evidence});
const options={sourceHash,readArtifact:name=>Buffer.from(data[name])};
test('local gate evidence never becomes a hosted scenario assertion',()=>{
 const r=deriveLocalRemediationEvidence(cert,options);
 assert.equal(Object.keys(r.batches).length,11);
 assert.equal(r.batches.B249.status,'LOCAL_GATE_EVIDENCE_ONLY');
 assert.equal(r.batches.B254.status,'BLOCKED');
 assert.ok(Object.values(r.batches).every(b=>!b.hostedExecuted&&!b.checksVerified));
 assert.equal(r.hostedDecision,'NO-GO');
 assert.deepEqual(validateLocalRemediationEvidence(r,cert,options),{valid:true,localDecision:'PARTIAL',hostedDecision:'NO-GO',hostedExecuted:false});
});
test('tampered, stale, or missing evidence fails closed',()=>{
 const r=deriveLocalRemediationEvidence(cert,options);
 r.batches.B249.checksVerified=true;
 assert.throws(()=>validateLocalRemediationEvidence(r,cert,options),/MISMATCH/);
 assert.throws(()=>deriveLocalRemediationEvidence(cert,{...options,sourceHash:'a'.repeat(64)}),/STALE_SOURCE/);
 assert.throws(()=>deriveLocalRemediationEvidence(cert,{...options,readArtifact:name=>name==='verify.log'?Buffer.from('tampered'):options.readArtifact(name)}),/EVIDENCE_CHANGED/);
});
