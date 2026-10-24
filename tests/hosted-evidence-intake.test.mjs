import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,symlinkSync,mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {canonical,digest,boundedJSON,validateRecord,verifyAuthorization} from '../domain/hosted-evidence.mjs';
import {safeRead} from '../server/hosted-evidence-store.mjs';
import {assessIndependentHostedRelease} from '../domain/independent-hosted-release.mjs';
import {evidenceFixture} from './helpers/hosted-evidence-fixture.mjs';
import {remediationBatches} from '../domain/remediation-wave.mjs';
import {hostedScenarios} from '../domain/operations-release.mjs';

function accept(f,s,r){let previous=null;for(const [i,state]of ['DRAFT','SUBMITTED','VALIDATED','REVIEWED','ACCEPTED'].entries()){s.apply(f.request(r,previous,state,i,i>=3?'reviewer':'collector'));previous=state}}
test('B256 canonical digests are stable; bounded JSON rejects malformed schemas and secrets',()=>{
 assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));
 for(const value of ['{"password":"hidden"}','{"x":"postgresql://user:value@host/db"}','{"__proto__":{}}','{bad'])assert.throws(()=>boundedJSON(Buffer.from(value)));
 assert.throws(()=>boundedJSON(Buffer.alloc(262145)),/SIZE/);
 let value={};for(let i=0;i<15;i++)value={value};assert.throws(()=>boundedJSON(Buffer.from(JSON.stringify(value))),/COMPLEXITY/);
});
test('B256 signed lifecycle verifies bytes, independent reviewer and immutable audit history',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record();accept(f,s,r);
 const result=s.inspect(r.id);assert.equal(result.state,'ACCEPTED');assert.equal(result.reviewer,'reviewer');assert.equal(result.approvalAt,f.now());assert.equal(result.revision,4);
 const release=assessIndependentHostedRelease({store:s,authorization:f.authorization,now:f.now()});assert.equal(release.hostedDecision,'NO-GO');assert.equal(release.productionDecision,'NO-GO');assert.ok(release.missingScenarios.includes('rollback'));
});
test('B256 rejects extra fields, stale source, wrong tenant/environment, dates and paths',t=>{
 const f=evidenceFixture(t),r=f.record();
 for(const patch of [{extra:true},{sourceHash:'c'.repeat(64)},{tenant:'other'},{environment:'production'},{gitSha:'c'.repeat(40)},{expiresAt:'2026-10-12T00:00:00.000Z'},{collectedAt:'2027-01-01T00:00:00.000Z'},{artifact:{...r.artifact,path:'../escape.json'}},{assertions:{verifiedMfa:true}}])assert.throws(()=>validateRecord({...r,...patch},f.binding,f.now()));
});
test('B256 unknown signer, self-approval and invalid transition fail closed',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record(),req=f.request(r,null,'DRAFT',0);
 assert.throws(()=>s.apply({...req,envelope:{...req.envelope,keyId:'unknown'}}),/UNTRUSTED/);s.apply(req);
 assert.throws(()=>s.apply(f.request(r,'DRAFT','ACCEPTED',1,'reviewer')),/LIFECYCLE/);
 s.apply(f.request(r,'DRAFT','SUBMITTED',1));s.apply(f.request(r,'SUBMITTED','VALIDATED',2));
 assert.throws(()=>s.apply(f.request(r,'VALIDATED','REVIEWED',3)),/INDEPENDENT/);
});
test('B256 replay and idempotency distinguish exact retry from new conflicting evidence',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record(),req=f.request(r,null,'DRAFT',0);
 assert.equal(s.apply(req).revision,0);assert.equal(s.apply(req).revision,0);
 const altered=f.request(r,'DRAFT','SUBMITTED',1,'collector',req.envelope.payload.requestId);assert.throws(()=>s.apply(altered),/IDEMPOTENCY/);
 assert.throws(()=>s.apply(f.request({...r,id:'another'},null,'DRAFT',0)),/REPLAYED/);
 assert.throws(()=>s.apply(f.request(r,'DRAFT','SUBMITTED',2)),/STALE_REVISION/);
});
test('B256 artifact byte tampering and ledger mutation are detected',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record();s.apply(f.request(r,null,'DRAFT',0));
 const file=join(f.root,r.artifact.path),raw=readFileSync(file);writeFileSync(file,'{}');assert.throws(()=>s.inspect(r.id),/TAMPERED/);writeFileSync(file,raw);
 s.db.prepare("UPDATE hosted_evidence_events SET previous_hash='changed'").run();assert.throws(()=>s.inspect(r.id),/AUDIT/);
});
test('B256 actual prerequisite bytes, approval expiry and revocation are required',t=>{
 const f=evidenceFixture(t);assert.equal(verifyAuthorization(f.authorization,f.policy,f.binding,f.now()).id,'grant_one');
 assert.throws(()=>verifyAuthorization(f.authorization,{...f.policy,readAttestation:()=>Buffer.from('{}')},f.binding,f.now()),/TAMPERED/);
 assert.throws(()=>verifyAuthorization(f.authorization,{...f.policy,revokedAuthorizations:['grant_one']},f.binding,f.now()),/AUTHORIZATION/);
 assert.throws(()=>verifyAuthorization(f.authorization,{...f.policy,revokedAttestations:['attestation_0']},f.binding,f.now()),/PREREQUISITE/);
 assert.throws(()=>verifyAuthorization(f.authorization,f.policy,f.binding,'2026-10-14T00:00:00.000Z'),/AUTHORIZATION/);
 const changed=structuredClone(f.authorization);changed.payload.syntheticOnly=false;assert.throws(()=>verifyAuthorization(changed,f.policy,f.binding,f.now()));
});
test('B256 expiration, signed revocation and cross-tenant ledger reads remain denied',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record();accept(f,s,r);
 s.apply(f.request(r,'ACCEPTED','REVOKED',5,'reviewer'));assert.equal(s.inspect(r.id).effectiveState,'REVOKED');assert.throws(()=>s.apply(f.request(r,'REVOKED','ACCEPTED',6,'reviewer')),/LIFECYCLE/);
 f.setNow('2026-10-14T00:00:00.000Z');assert.equal(s.inspect(r.id).effectiveState,'EXPIRED');
 s.binding={...f.binding,tenant:'other'};assert.throws(()=>s.inspect(r.id),/NOT_FOUND/);
});
test('B256 safe paths reject traversal, absolute paths and directory symlinks',t=>{
 const f=evidenceFixture(t);f.record();
 for(const name of ['../escape','C:/escape','artifacts/../escape','artifacts\\escape'])assert.throws(()=>safeRead(f.root,name));
 mkdirSync(join(f.root,'target'));writeFileSync(join(f.root,'target','data.json'),'{}');
 symlinkSync(join(f.root,'target'),join(f.root,'alias'),'junction');assert.throws(()=>safeRead(f.root,'alias/data.json'),/SYMLINK/);
});
test('B256 independent database connections serialize competing signed revisions',async t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record();s.apply(f.request(r,null,'DRAFT',0));
 const moduleUrl=new URL('../server/hosted-evidence-store.mjs',import.meta.url).href;
 const policy=structuredClone({...f.policy,readAttestation:undefined});
 const run=request=>new Promise((resolve,reject)=>{
  const w=new Worker(`const {parentPort,workerData:d}=require('node:worker_threads');(async()=>{const {HostedEvidenceStore,safeRead}=await import(d.moduleUrl);let s;try{s=new HostedEvidenceStore({database:d.root+'/ledger.sqlite',artifactRoot:d.root,policy:{...d.policy,readAttestation:h=>safeRead(d.root,'attestations/'+h+'.json')},binding:d.binding,now:()=>d.now});s.apply(d.request);parentPort.postMessage('PASS')}catch(e){parentPort.postMessage(e.message)}finally{s?.close()}})()`,{eval:true,workerData:{moduleUrl,root:f.root,policy,binding:f.binding,now:f.now(),request}});
  // A message can precede the worker's finally/SQLite close on Windows.
  let result;w.once('message',value=>{result=value;});w.once('error',reject);
  w.once('exit',code=>code===0&&typeof result==='string'?resolve(result):reject(Error('SYNTHETIC_EVIDENCE_WORKER_FAILED')));
 });
 const results=await Promise.all([run(f.request(r,'DRAFT','SUBMITTED',1)),run(f.request(r,'DRAFT','SUBMITTED',1))]);assert.deepEqual(results.sort(),['PASS','STALE_REVISION']);assert.equal(s.inspect(r.id).revision,1);
});
test('B256 local-fixture accepted records never establish hosted execution',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record({method:'fixture-runner',provenance:{scope:'local-fixture',runId:'local_run'}});accept(f,s,r);
 const report=assessIndependentHostedRelease({store:s,authorization:f.authorization,now:f.now()});assert.equal(report.hostedExecuted,false);assert.equal(report.accepted,0);assert.equal(report.productionDecision,'NO-GO');
});
test('B256 full signed fixture coverage still requires independent checkpoint and release approvals',t=>{
 const f=evidenceFixture(t),s=f.open();
 for(const [batch,definition]of Object.entries(remediationBatches)){
  const scenario=definition.scenario,assertions=Object.fromEntries((hostedScenarios.find(x=>x.id===scenario)?.checks??[]).map(x=>[x,true]));
  const r=f.record({id:'evidence_'+batch,batch,scenario,assertions,provenance:{scope:'independent-hosted',runId:'run_'+batch}});accept(f,s,r);
 }
 const assess=extra=>assessIndependentHostedRelease({store:s,authorization:f.authorization,now:f.now(),...extra});
 const initial=assess();assert.deepEqual(initial.missingBatches,[]);assert.deepEqual(initial.missingScenarios,[]);assert.equal(initial.hostedDecision,'NO-GO');
 const approval=(key,purpose)=>f.envelope(key,{purpose,...f.binding,ledgerDigest:initial.ledgerDigest,approvedAt:f.now(),expiresAt:'2026-10-14T00:00:00.000Z'});
 const securityApproval=approval('security','security-release'),productionApproval=approval('release','production-release');
 assert.equal(assess({securityApproval,productionApproval}).productionDecision,'NO-GO');
 f.policy.ledgerDigest=initial.ledgerDigest;
 assert.equal(assess({securityApproval}).hostedDecision,'GO');assert.equal(assess({securityApproval}).productionDecision,'NO-GO');
 assert.equal(assess({securityApproval,productionApproval}).productionDecision,'GO');
 // This is a cryptographic verifier fixture, not evidence of an actual hosted execution.
 f.policy.keys.security.revoked=true;assert.throws(()=>assess({securityApproval,productionApproval}),/UNTRUSTED/);
});
test('B256 failure receipts, modified signatures and missing prerequisites cannot be accepted',t=>{
 const f=evidenceFixture(t),s=f.open(),r=f.record({result:'FAIL',assertions:{verifiedMfa:false,tenantBound:true,revokedSessionDenied:true}});
 const request=f.request(r,null,'DRAFT',0);assert.throws(()=>s.apply({...request,envelope:{...request.envelope,signature:'A'.repeat(86)+'=='}}),/SIGNATURE/);
 s.apply(request);s.apply(f.request(r,'DRAFT','SUBMITTED',1));s.apply(f.request(r,'SUBMITTED','VALIDATED',2));assert.throws(()=>s.apply(f.request(r,'VALIDATED','REVIEWED',3,'reviewer')),/FAILED_EVIDENCE/);
 const grant=structuredClone(f.authorization);delete grant.payload.prerequisites.approvedConsent;assert.throws(()=>verifyAuthorization(grant,f.policy,f.binding,f.now()),/SCHEMA/);
});
test('B256 rejection, expiration and supersession are terminal signed states',t=>{
 const f=evidenceFixture(t),s=f.open();
 for(const [index,terminal]of ['REJECTED','EXPIRED','SUPERSEDED'].entries()){
  f.setNow('2026-10-13T12:00:00.000Z');const r=f.record({id:'terminal_'+index,provenance:{scope:'independent-hosted',runId:'terminal_run_'+index}});
  if(terminal==='SUPERSEDED'){accept(f,s,r);s.apply(f.request(r,'ACCEPTED',terminal,5,'reviewer'))}
  else{s.apply(f.request(r,null,'DRAFT',0));if(terminal==='EXPIRED')f.setNow('2026-10-14T00:00:00.000Z');s.apply(f.request(r,'DRAFT',terminal,1,'reviewer'))}
  assert.equal(s.inspect(r.id).state,terminal);
 }
});
