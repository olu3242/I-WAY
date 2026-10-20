import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../../scripts/compare-tracking-baselines.mjs',import.meta.url).pathname;
const fixture=()=>{const samples=Array.from({length:21},()=>0.02);return {schemaVersion:2,workload:'tracking-history-indexed-64-events-limit-20',environment:'disposable-postgresql',warmupCount:3,sampleCount:21,unit:'ms',executionTimeMs:{min:0.02,median:0.02,p90:0.02,p95:0.02,max:0.02},executionSamplesMs:samples,planningTimeMs:{median:0.05},rowsReturned:20,planNode:'Limit',sharedHitBlocks:4,sharedReadBlocks:0,productionSloCertified:false}};
const run=(mutate=()=>{},count=3)=>{const dir=mkdtempSync(join(tmpdir(),'iway-tracking-policy-'));try{const paths=[];for(let i=0;i<count;i++){const r=fixture();mutate(r,i);const path=join(dir,'run-'+i+'.json');writeFileSync(path,JSON.stringify(r));paths.push(path)}const result=spawnSync(process.execPath,[script,...paths],{encoding:'utf8'});return {status:result.status,stdout:result.stdout,stderr:result.stderr,report:result.status===0?JSON.parse(result.stdout):null}}finally{rmSync(dir,{recursive:true,force:true})}};
const cases=[
 ['three-run report valid',null,true],
 ['two-run report valid but insufficient',null,true,2],
 ['schema version rejected',r=>r.schemaVersion=1,false],
 ['environment rejected',r=>r.environment='production',false],
 ['warmup count rejected',r=>r.warmupCount=0,false],
 ['sample count rejected',r=>r.sampleCount=20,false],
 ['row count rejected',r=>r.rowsReturned=19,false],
 ['production certification rejected',r=>r.productionSloCertified=true,false],
 ['negative median rejected',r=>r.executionTimeMs.median=-1,false],
 ['negative p95 rejected',r=>r.executionTimeMs.p95=-1,false],
 ['negative max rejected',r=>r.executionTimeMs.max=-1,false],
 ['missing samples rejected',r=>delete r.executionSamplesMs,false],
 ['short samples rejected',r=>r.executionSamplesMs.pop(),false],
 ['negative sample rejected',r=>r.executionSamplesMs[0]=-1,false],
 ['nonfinite sample rejected',r=>r.executionSamplesMs[0]='NaN',false],
 ['incorrect median rejected',r=>r.executionTimeMs.median=0.03,false],
 ['incorrect p95 rejected',r=>r.executionTimeMs.p95=0.03,false],
 ['negative planning median rejected',r=>r.planningTimeMs.median=-1,false],
 ['wrong unit rejected',r=>r.unit='seconds',false],
 ['incomparable workload rejected',(r,i)=>{if(i===1)r.workload='other'},false]
];
for(const [name,mutate,valid,count] of cases)test(name,()=>{const x=run(mutate??(()=>{}),count??3);assert.equal(x.status,valid?0:1,x.stderr);if(valid){assert.equal(x.report.performanceGateEnabled,false);assert.equal(x.report.gateDecision.eligible,false);if(count===2)assert.ok(x.report.gateDecision.reasons.includes('insufficient-independent-runs'))}});
