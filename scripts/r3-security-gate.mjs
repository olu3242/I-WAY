import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessAuthorization(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Security evidence required']};
 const {environment,sourceCommit,authentication,authorization,tenantIsolation,qaDelegation,rls,review}=evidence;
 if(environment!=='hosted-nonproduction')reasons.push('Approved hosted nonproduction environment required');
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned source commit required');
 for(const [name,group] of Object.entries({authentication,authorization,tenantIsolation,rls})){
  if(!group||group.passed!==true||!Number.isInteger(group.assertions)||group.assertions<1||group.deniedByDefault!==true)reasons.push(name+' requires passing deny-by-default tests');
 }
 if(!qaDelegation||qaDelegation.productionDenied!==true||qaDelegation.verifiedActorRequired!==true||qaDelegation.qaOnlyTargets===false||qaDelegation.qaOnlyTargets!==true||qaDelegation.tenantBound!==true||qaDelegation.reasonRequired!==true||qaDelegation.maxMinutes>15||!Number.isInteger(qaDelegation.maxMinutes)||qaDelegation.maxMinutes<1||qaDelegation.revocationVerified!==true||qaDelegation.auditVerified!==true)reasons.push('QA delegation policy, audit and revocation requirements not proven');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||!/^sha256:[a-f0-9]{64}$/.test(review.evidenceDigest||''))reasons.push('Independent security approval and evidence digest required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r3-security-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessAuthorization(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
