import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessHostedOperations(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Hosted operations evidence required']};
 const {environment,sourceCommit,transport,configuration,observability,operations,security,review}=evidence;
 if(environment!=='hosted-nonproduction')reasons.push('Approved hosted nonproduction environment required');
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned source commit required');
 if(!transport||transport.trusted===false||transport.trusted!==true||transport.authorized===false||transport.authorized!==true||transport.signedObservations!==true)reasons.push('Trusted authorized transport and signed observations required');
 if(!configuration||configuration.secretsExternalized!==true||configuration.tlsVerified!==true||configuration.tenantBound!==true||configuration.leastPrivilegeVerified!==true)reasons.push('Externalized secrets, TLS, tenant binding and least privilege required');
 if(!observability||observability.auditDurable!==true||observability.alertsTested!==true||observability.errorBudgetDefined!==true||observability.tracesVerified!==true)reasons.push('Durable audit, alerting, error budget and tracing required');
 if(!operations||operations.rollbackRehearsed!==true||operations.incidentRunbookTested!==true||operations.backupRestoreVerified!==true||operations.capacityReviewed!==true)reasons.push('Rollback, incident response, recovery and capacity checks required');
 if(!security||security.vulnerabilityReviewApproved!==true||security.accessReviewApproved!==true||security.dataRetentionApproved!==true)reasons.push('Independent vulnerability, access and retention approvals required');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||!/^sha256:[a-f0-9]{64}$/.test(review.evidenceDigest||''))reasons.push('Independent operational approval and immutable evidence digest required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r9-hosted-operations-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessHostedOperations(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
