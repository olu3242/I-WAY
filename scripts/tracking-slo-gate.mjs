import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
function positive(n){return typeof n==='number'&&Number.isFinite(n)&&n>0;}
export function assessTrackingPerformance(evidence){
 const reasons=[];
 if(!evidence||typeof evidence!=='object')return {decision:'NO-GO',reasons:['Evidence is required']};
 const {baseline,after,repeat,slo}=evidence;
 for(const [name,sample] of Object.entries({baseline,after,repeat})){
  if(!sample||!positive(sample.p95Ms)||!positive(sample.requestsPerSecond)||!Number.isInteger(sample.requests)||sample.requests<100||!Number.isInteger(sample.errors)||sample.errors<0)reasons.push(name+': incomplete or invalid measurement');
 }
 if(!slo||!positive(slo.maxP95Ms)||!positive(slo.minRequestsPerSecond)||!Number.isInteger(slo.maxErrors)||slo.maxErrors<0||slo.approved!==true)reasons.push('Approved numeric SLO required');
 if(!evidence.environment||!evidence.commitSha||!evidence.fixtureDigest||!evidence.concurrency||!Number.isInteger(evidence.concurrency)||evidence.concurrency<1)reasons.push('Comparable environment, commit, fixture digest and concurrency required');
 if(reasons.length)return {decision:'NO-GO',reasons};
 for(const name of ['after','repeat']){
  const sample=evidence[name];
  if(sample.p95Ms>slo.maxP95Ms)reasons.push(name+': p95 exceeds approved SLO');
  if(sample.requestsPerSecond<slo.minRequestsPerSecond)reasons.push(name+': throughput below approved SLO');
  if(sample.errors>slo.maxErrors)reasons.push(name+': errors exceed approved SLO');
 }
 if(evidence.after.p95Ms>evidence.baseline.p95Ms||evidence.repeat.p95Ms>evidence.baseline.p95Ms)reasons.push('Tracking latency regressed against baseline');
 if(evidence.after.requestsPerSecond<evidence.baseline.requestsPerSecond||evidence.repeat.requestsPerSecond<evidence.baseline.requestsPerSecond)reasons.push('Tracking throughput regressed against baseline');
 return {decision:reasons.length?'NO-GO':'ELIGIBLE_FOR_REVIEW',reasons};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const path=process.argv[2];if(!path){process.stderr.write('Usage: node scripts/tracking-slo-gate.mjs evidence.json\n');process.exitCode=2;}
 else try{const result=assessTrackingPerformance(JSON.parse(readFileSync(path,'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.decision!=='ELIGIBLE_FOR_REVIEW')process.exitCode=1;}catch(error){process.stderr.write('Invalid evidence: '+error.message+'\n');process.exitCode=2;}
}
