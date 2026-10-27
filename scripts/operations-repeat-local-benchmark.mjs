// Run the unchanged benchmark CLI sequentially; collect bounded host-only numeric metadata.
// No environment files, credentials, tenant identifiers, or process inventories are read.
import {spawn} from 'node:child_process';
import {cpus,totalmem,freemem} from 'node:os';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {assessPerformanceSeries} from '../domain/operations-performance-series.mjs';
const out=resolve(process.argv[2]??'dist/local-performance-series');
if(existsSync(out))throw Error('NEW_EVIDENCE_DIRECTORY_REQUIRED');
mkdirSync(out,{recursive:true});
const cpu=()=>cpus().reduce((sum,c)=>({idle:sum.idle+c.times.idle,total:sum.total+Object.values(c.times).reduce((n,x)=>n+x,0)}),{idle:0,total:0});
const reports=[];
for(let repetition=1;repetition<=5;repetition++){
 const priorRunId=existsSync('dist/operations-evidence/performance.json')?JSON.parse(readFileSync('dist/operations-evidence/performance.json','utf8')).runId:null;
 const samples=[],started=performance.now();let previous=cpu(),observed=0;
 const timer=setInterval(()=>{const next=cpu(),total=next.total-previous.total;observed++;if(samples.length<600)samples.push({elapsedMs:performance.now()-started,hostCpuBusyPercent:total>0?100*(1-(next.idle-previous.idle)/total):null,freeMemoryBytes:freemem(),totalMemoryBytes:totalmem()});previous=next;},1000);
 const fd=openSync(join(out,'run-'+repetition+'.log'),'wx');let exitCode;
 try{exitCode=await new Promise((accept,reject)=>{const child=spawn(process.execPath,['scripts/operations-benchmark.mjs'],{windowsHide:true,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('close',accept);});}finally{clearInterval(timer);closeSync(fd);}
 const report=JSON.parse(readFileSync('dist/operations-evidence/performance.json','utf8'));if(!report.runId||report.runId===priorRunId)throw Error('FRESH_BENCHMARK_REPORT_REQUIRED');reports.push(report);
 writeFileSync(join(out,'run-'+repetition+'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 writeFileSync(join(out,'host-'+repetition+'.json'),JSON.stringify({scope:'shared host; one-second CPU deltas; no process or tenant data',repetition,exitCode,elapsedMs:performance.now()-started,observed,sampled:samples.length,truncated:observed>samples.length,samples},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({repetition,exitCode,status:report.status,runId:report.runId}));
}
const baseline=JSON.parse(readFileSync('docs/operations/PERFORMANCE_BASELINE.json','utf8')),assessment=assessPerformanceSeries(reports,baseline);
writeFileSync(join(out,'assessment.json'),JSON.stringify(assessment,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(assessment));if(!assessment.allRunsPassed)process.exitCode=1;
