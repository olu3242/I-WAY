import {readFileSync} from 'node:fs';
const file=process.argv[2];
if(!file)throw Error('PostgreSQL tracking load report required');
const r=JSON.parse(readFileSync(file,'utf8'));
const fail=reason=>{throw Error('R5 PostgreSQL tracking load invalid: '+reason)};
if(r.schemaVersion!==1||r.environment!=='disposable-postgresql-domain'||r.scope!=='tracking-projection-no-http'||r.productionSloCertified!==false)fail('scope');
if(r.requests!==29||!Array.isArray(r.concurrency)||r.concurrency.join(',')!=='1,4,8,16'||!Array.isArray(r.runs)||r.runs.length!==4)fail('workload');
for(const key of ['p50Ms','p95Ms','p99Ms'])if(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<=0)fail(key);
if(r.p50Ms>r.p95Ms||r.p95Ms>r.p99Ms)fail('percentile ordering');
for(let i=0;i<4;i++){
 const run=r.runs[i];
 if(run.concurrency!==r.concurrency[i]||run.requests!==r.concurrency[i])fail('run '+i);
 if(!Number.isFinite(run.elapsedMs)||run.elapsedMs<=0||!Number.isFinite(run.requestsPerSecond)||run.requestsPerSecond<=0)fail('timing '+i);
 if(Math.abs(run.requests*1000/run.elapsedMs-run.requestsPerSecond)>0.0001)fail('throughput '+i);
}
console.log(JSON.stringify({decision:'DISPOSABLE_PG_DOMAIN_LOAD_PASS',requests:r.requests,productionSloCertified:false}));
