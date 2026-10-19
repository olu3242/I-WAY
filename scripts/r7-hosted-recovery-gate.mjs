import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessHostedRecovery(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Hosted recovery evidence required']};
 const {environment,sourceCommit,backup,restore,recovery,slo,review}=evidence;
 if(environment!=='hosted-nonproduction')reasons.push('Approved hosted nonproduction environment required');
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned source commit required');
 if(!backup||backup.completed!==true||!/^sha256:[a-f0-9]{64}$/.test(backup.manifestDigest||''))reasons.push('Verified backup manifest required');
 if(!restore||restore.completed!==true||restore.manifestVerified!==true||restore.auditChainVerified!==true||restore.tenantIsolationVerified!==true)reasons.push('Restore integrity, audit chain and tenant isolation must pass');
 if(!recovery||!Number.isFinite(recovery.rpoMs)||recovery.rpoMs<0||!Number.isFinite(recovery.rtoMs)||recovery.rtoMs<0||recovery.applicationHealthy!==true)reasons.push('Measured nonnegative RPO/RTO and healthy application required');
 if(!slo||slo.approved!==true||!Number.isFinite(slo.maxRpoMs)||slo.maxRpoMs<0||!Number.isFinite(slo.maxRtoMs)||slo.maxRtoMs<0)reasons.push('Approved numeric recovery objectives required');
 if(recovery&&slo&&Number.isFinite(recovery.rpoMs)&&Number.isFinite(slo.maxRpoMs)&&recovery.rpoMs>slo.maxRpoMs)reasons.push('Observed RPO exceeds objective');
 if(recovery&&slo&&Number.isFinite(recovery.rtoMs)&&Number.isFinite(slo.maxRtoMs)&&recovery.rtoMs>slo.maxRtoMs)reasons.push('Observed RTO exceeds objective');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||typeof review.evidenceDigest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(review.evidenceDigest))reasons.push('Independent approval and immutable evidence digest required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r7-hosted-recovery-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessHostedRecovery(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
