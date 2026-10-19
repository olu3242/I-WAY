import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessAgentRuntime(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Agent execution evidence required']};
 const {sourceCommit,environment,agents,jobs,handoffs,recovery,consent,review}=evidence;
 if(typeof sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(sourceCommit))reasons.push('Pinned source commit required');
 if(environment!=='approved-nonproduction')reasons.push('Approved nonproduction runtime required');
 if(!Array.isArray(agents)||agents.length!==7||new Set(agents.map(x=>x?.name)).size!==7||agents.some(x=>!x?.executed||!x?.identityVerified))reasons.push('Seven distinct agents must execute under verified identities');
 if(!jobs||jobs.durable!==true||jobs.idempotentRetries!==true||!Number.isInteger(jobs.completed)||jobs.completed<7||jobs.failed!==0)reasons.push('Durable idempotent jobs and successful execution required');
 if(!handoffs||handoffs.authorized===false||handoffs.authorized!==true||!Number.isInteger(handoffs.verified)||handoffs.verified<1||handoffs.crossTenantDenied!==true)reasons.push('Authorized handoffs and cross-tenant denial required');
 if(!recovery||recovery.retryVerified!==true||recovery.deadLetterVerified!==true||recovery.resumeVerified!==true||recovery.auditVerified!==true)reasons.push('Retry, dead-letter, resume and audit recovery required');
 if(!consent||consent.liveModelUsed===true&&consent.approved!==true||consent.liveModelUsed!==true&&consent.liveModelUsed!==false)reasons.push('Explicit live-model use declaration and approval required');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||!/^sha256:[a-f0-9]{64}$/.test(review.evidenceDigest||''))reasons.push('Independent approval and immutable evidence digest required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r5-agent-runtime-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessAgentRuntime(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
