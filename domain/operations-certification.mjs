import{createHash}from'node:crypto';import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export const localGateNames=Object.freeze(['verify','browser','performance','recovery','evaluation','publicTarget']);
export const artifactNames=Object.freeze({browser:'browser-evidence.json',performance:'performance.json',recovery:'recovery.json',evaluation:'evaluation.json'});
export const parkedGates=Object.freeze(['restrictedPostgresAuthentication','approvedConsent','exposedCredentialRotation','hostedIdentityAndPersistence','approvedAIProvider','deploymentAuthorization']);
export function sourceFingerprint(root=process.cwd()){
 const list=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const files=[...new Set([...list(['ls-files']),...list(['ls-files','--others','--exclude-standard'])])].filter(p=>/^(domain|server|scripts|apps|tests|site|supabase|lib|migrations|execution)\//.test(p)||['package.json','package-lock.json','playwright.config.mjs','docs/operations/PERFORMANCE_BASELINE.json','docs/operations/PUBLIC_RELEASE_TARGET.json'].includes(p)).sort();
 return sha256(Buffer.concat(files.flatMap(p=>[Buffer.from(p+'\0'),readFileSync(new URL(p.replaceAll('\\','/'),new URL('file:///'+root.replaceAll('\\','/')+'/'))),Buffer.from('\0')])));
}
export function parseCounts(log,kind){
 if(kind==='verify'){
  const get=key=>{const match=log.match(new RegExp('(?:#|ℹ)\\s+'+key+'\\s+(\\d+)'));return match?Number(match[1]):null;};
  return {passed:get('pass'),failed:get('fail'),skipped:get('skipped')};
 }
 if(kind==='browser')return {passed:Number(log.match(/(\d+) passed(?:\s|$)/)?.[1]??0),failed:Number(log.match(/(\d+) failed(?:\s|$)/)?.[1]??0),skipped:Number(log.match(/(\d+) skipped(?:\s|$)/)?.[1]??0)};
 return null;
}
export function createCertification({sourceHash,baseCommit,evidence,now=new Date().toISOString()}){
 const complete=localGateNames.every(name=>evidence[name]?.exitCode===0);
 return {schemaVersion:1,generatedAt:now,sourceHash,baseCommit,scope:'isolated local operational fixtures',localDecision:complete?'PARTIAL':'NO-GO',localExecutableGate:complete?'PASS':'FAIL',hostedDecision:'NO-GO',
  evidence,hostedGates:Object.fromEntries(parkedGates.map(name=>[name,'BLOCKED'])),
  manualGates:{wcag22AAManual:'PENDING',independentModelEvaluation:'BLOCKED',causalROIBaseline:'UNAVAILABLE'},
  limitations:['Local tests do not certify hosted identity, PostgreSQL RLS, live providers or production release.','Accessibility automation does not replace manual assistive-technology assessment.']};
}
export function validateCertification(manifest,{sourceHash,readArtifact}){
 if(manifest.schemaVersion!==1||manifest.sourceHash!==sourceHash||!/^[a-f0-9]{64}$/.test(sourceHash))throw Error('STALE_SOURCE');
 if(manifest.hostedDecision!=='NO-GO'||parkedGates.some(g=>manifest.hostedGates?.[g]!=='BLOCKED'))throw Error('HOSTED_GATE_BYPASS');
 for(const name of localGateNames){
  const e=manifest.evidence?.[name];if(!e||e.logFile!==name+'.log'||!Number.isInteger(e.exitCode))throw Error('EVIDENCE_MISSING');
  const raw=readArtifact(e.logFile);if(sha256(raw)!==e.logSha256)throw Error('EVIDENCE_CHANGED');
  if(artifactNames[name]){
   if(e.artifact?.file!==artifactNames[name])throw Error('ARTIFACT_MISSING');
   const rawArtifact=readArtifact(e.artifact.file);if(sha256(rawArtifact)!==e.artifact.sha256)throw Error('ARTIFACT_CHANGED');
   let data;try{data=JSON.parse(rawArtifact)}catch{throw Error('ARTIFACT_INVALID')}
   if(name==='browser'&&(data.status!=='passed'||data.counts?.failed!==0||data.counts?.skipped!==0||data.counts?.passed!==e.counts?.passed||!Number.isSafeInteger(data.accessibility?.scanCount)||data.accessibility.scanCount<1||data.accessibility?.violationCount!==0||data.accessibility?.conformance!=='manual_review_required'))throw Error('ACCESSIBILITY_GATE');
   if(name==='evaluation'&&(data.localStatus!=='PASS'||data.summary?.passed!==data.summary?.total||!Number.isSafeInteger(data.summary?.total)||data.summary.total<12||data.summary?.failed!==0||data.summary?.skipped!==0||data.summary?.modelInferenceCount!==0||data.modelEvaluation?.status!=='BLOCKED'))throw Error('EVALUATION_GATE');
   if(['performance','recovery'].includes(name)&&data.status!=='PASS')throw Error('MEASUREMENT_GATE');
   if(name==='recovery'&&(!Number.isFinite(data.observedRpoMs)||!Number.isFinite(data.observedRtoMs)||data.hostedCertified!==false))throw Error('RECOVERY_GATE');
  }
  if(['verify','browser'].includes(name)){
   const actual=parseCounts(raw.toString(),name);if(JSON.stringify(actual)!==JSON.stringify(e.counts)||actual.passed<(name==='verify'?134:8)||actual.failed!==0||actual.skipped!==0)throw Error('TEST_GATE_FAILED');
  }
 }
 const complete=localGateNames.every(name=>manifest.evidence[name].exitCode===0);
 if(manifest.localExecutableGate!==(complete?'PASS':'FAIL')||manifest.localDecision!==(complete?'PARTIAL':'NO-GO'))throw Error('DECISION_MISMATCH');
 if(!complete)throw Error('LOCAL_GATE_FAILED');
 if(manifest.manualGates?.wcag22AAManual!=='PENDING'||manifest.manualGates?.independentModelEvaluation!=='BLOCKED'||manifest.manualGates?.causalROIBaseline!=='UNAVAILABLE')throw Error('UNVERIFIED_GATE');
 return {valid:true,localDecision:manifest.localDecision,hostedDecision:manifest.hostedDecision};
}
