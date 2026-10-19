import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessIntegrations(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Integration evidence required']};
 const {environment,sourceCommit,adapters,payments,webhooks,security,review}=evidence;
 if(environment!=='approved-sandbox')reasons.push('Approved sandbox environment required');
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned source commit required');
 if(!Array.isArray(adapters)||adapters.length<1||new Set(adapters.map(a=>a?.name)).size!==adapters.length||adapters.some(a=>typeof a?.name!=='string'||!a.name.trim()||a.authorized!==true||a.contractPassed!==true||a.failureHandlingPassed!==true))reasons.push('Named authorized adapters need contract and failure-path tests');
 if(!payments||payments.sandboxOnly!==true||payments.idempotencyVerified!==true||payments.reconciliationVerified!==true||payments.duplicateChargeDenied!==true||payments.refundOrReversalVerified!==true)reasons.push('Sandbox payment idempotency, reconciliation and reversal required');
 if(!webhooks||webhooks.signatureVerified!==true||webhooks.replayDenied!==true||webhooks.outOfOrderHandled!==true||webhooks.retryVerified!==true)reasons.push('Signed webhooks, replay denial, ordering and retry required');
 if(!security||security.noLiveCredentials===false||security.noLiveCredentials!==true||security.tenantIsolationVerified!==true||security.auditVerified!==true)reasons.push('No live credentials, tenant isolation and audit verification required');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||!/^sha256:[a-f0-9]{64}$/.test(review.evidenceDigest||''))reasons.push('Independent approval and immutable evidence digest required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r8-integrations-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessIntegrations(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
