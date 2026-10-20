import {readFileSync} from 'node:fs';
const file=process.argv[2];
if(!file)throw Error('R5 evidence file required');
const r=JSON.parse(readFileSync(file,'utf8'));
const fail=message=>{throw Error('R5 API load evidence invalid: '+message)};
if(r.schemaVersion!==1||r.environment!=='disposable-local-http-sqlite'||r.source!=='makeOperationsApp'||r.authenticated!==true||r.productionSloCertified!==false)fail('scope');
if(!Array.isArray(r.scenarios)||r.scenarios.length!==4)fail('scenario count');
const expected=[1,4,8,16];
for(let i=0;i<expected.length;i++){
 const x=r.scenarios[i];
 if(x.path!=='/api/ops/state'||x.concurrency!==expected[i]||x.requests!==40||x.errors!==0)fail('scenario '+i);
 if(![x.durationMs,x.p50Ms,x.p95Ms,x.p99Ms,x.requestsPerSecond].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))fail('metrics '+i);
 if(!(x.p50Ms<=x.p95Ms&&x.p95Ms<=x.p99Ms))fail('percentile order '+i);
 const derived=x.requests*1000/x.durationMs;
 if(Math.abs(derived-x.requestsPerSecond)>0.0001)fail('throughput '+i);
}
if(r.unauthorized?.requests!==10||r.unauthorized?.expectedStatus!==401)fail('unauthorized');
console.log(JSON.stringify({decision:'LOCAL_API_SMOKE_PASS',productionSloCertified:false,scenarios:r.scenarios.length,requests:r.scenarios.reduce((sum,x)=>sum+x.requests,0)}));
