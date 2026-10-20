import {readFileSync} from 'node:fs';
const files=process.argv.slice(2);
if(files.length<2)throw Error('At least two independent benchmark files required');
const reports=files.map(file=>JSON.parse(readFileSync(file,'utf8')));
for(const r of reports){
 if(r.schemaVersion!==2||r.environment!=='disposable-postgresql'||r.sampleCount!==21||r.warmupCount!==3||r.rowsReturned!==20||r.productionSloCertified!==false)throw Error('Invalid tracking benchmark report');
 for(const key of ['median','p95','max'])if(!Number.isFinite(r.executionTimeMs[key])||r.executionTimeMs[key]<0)throw Error('Invalid execution time: '+key);
 if(!Array.isArray(r.executionSamplesMs)||r.executionSamplesMs.length!==21)throw Error('Missing raw benchmark samples');
}
if(new Set(reports.map(x=>x.workload)).size!==1)throw Error('Incomparable workloads');
const medianValues=reports.map(x=>x.executionTimeMs.median),p95Values=reports.map(x=>x.executionTimeMs.p95);
const spread=values=>({min:Math.min(...values),max:Math.max(...values),ratio:Math.min(...values)>0?Math.max(...values)/Math.min(...values):null});
const result={schemaVersion:1,workload:reports[0].workload,environment:'disposable-postgresql',independentRuns:reports.length,samplesPerRun:21,medianMs:medianValues,p95Ms:p95Values,medianSpread:spread(medianValues),p95Spread:spread(p95Values),performanceGateEnabled:false,productionSloCertified:false,interpretation:'Descriptive CI baseline only; do not use as a production SLO or hard regression threshold'};
console.log(JSON.stringify(result,null,2));
