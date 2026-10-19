import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function assessPostgresParity(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return {decision:'NO-GO',reasons:['Evidence required']};
 const {environment,commitSha,commands,tenantIsolation,rls,authentication,run,review}=evidence;
 if(environment!=='hosted-nonproduction')reasons.push('Approved hosted nonproduction environment required');
 if(typeof commitSha!=='string'||!/^[0-9a-f]{40}$/.test(commitSha))reasons.push('Pinned source commit required');
 if(!commands||!Number.isInteger(commands.expected)||commands.expected<72||!Number.isInteger(commands.tested)||commands.tested!==commands.expected||commands.failed!==0||!Array.isArray(commands.missing)||commands.missing.length!==0)reasons.push('All expected PostgreSQL commands must pass without omissions');
 for(const [key,value] of Object.entries({tenantIsolation,rls,authentication})){if(!value||value.passed!==true||!Number.isInteger(value.assertions)||value.assertions<1)reasons.push(key+' must have passing real database assertions');}
 if(!run||typeof run.evidenceDigest!=='string'||!/^sha256:[0-9a-f]{64}$/.test(run.evidenceDigest)||typeof run.completedAt!=='string'||!Number.isFinite(Date.parse(run.completedAt))||run.syntheticFixtures!==true)reasons.push('Immutable run evidence and synthetic fixtures required');
 if(!review||review.approved!==true||typeof review.reviewer!=='string'||review.reviewer.trim().length<3||typeof review.approvalReference!=='string'||review.approvalReference.trim().length<3)reasons.push('Independent reviewer approval required');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 if(!process.argv[2]){process.stderr.write('Usage: node scripts/r4-postgres-parity-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessPostgresParity(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch{process.stderr.write('Invalid evidence\n');process.exitCode=2;}
}
