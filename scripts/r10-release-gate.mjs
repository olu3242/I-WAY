import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const gateIds=Array.from({length:9},(_,i)=>'R'+(i+2));
export function assessRelease(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Release dossier required']};
 const {sourceCommit,sourceReconciliation,ci,gates,approvals}=evidence;
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned candidate commit required');
 if(!sourceReconciliation||sourceReconciliation.verified!==true||sourceReconciliation.archiveDigestVerified!==true||sourceReconciliation.branchDiffReviewed!==true)reasons.push('R1 source archive reconciliation required');
 if(!ci||ci.conclusion!=='success'||ci.commitSha!==sourceCommit||!Number.isInteger(ci.browserPassed)||ci.browserPassed<19||ci.securityChecksPassed!==true)reasons.push('Passing CI for exact candidate commit and security checks required');
 if(!gates||typeof gates!=='object'||Array.isArray(gates))reasons.push('R2-R9 evidence records required');
 else for(const id of gateIds.filter(x=>x!=='R10')){
  const gate=gates[id];
  if(!gate||gate.status!=='ACCEPTED'||gate.sourceCommit!==sourceCommit||!/^sha256:[a-f0-9]{64}$/.test(gate.evidenceDigest||'')||typeof gate.reviewer!=='string'||gate.reviewer.trim().length<3)reasons.push(id+': independently accepted evidence for exact candidate required');
 }
 if(!approvals||approvals.security!==true||approvals.operations!==true||approvals.product!==true||approvals.productionRelease!==true||typeof approvals.changeReference!=='string'||approvals.changeReference.trim().length<3)reasons.push('Explicit security, operations, product and production change approvals required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_RELEASE_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r10-release-gate.mjs dossier.json\n');process.exitCode=2;}
 else try{const result=assessRelease(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_RELEASE_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid dossier\n');process.exitCode=2;}
}
