import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fixture,password} from '../helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../../server/operations-app.mjs';
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
async function start(t){
 const f=await fixture(t),server=makeOperationsApp({store:f.store,operations:f.ops});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const login=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:f.manager.username,password})});
 assert.equal(login.status,200);
 return {base,cookie:login.headers.get('set-cookie').split(';')[0]};
}
async function sample(base,path,headers,requests,concurrency){
 const timings=[],statuses=[],started=performance.now();
 for(let offset=0;offset<requests;offset+=concurrency){
  await Promise.all(Array.from({length:Math.min(concurrency,requests-offset)},async()=>{
   const t=performance.now();const response=await fetch(base+path,{headers});await response.arrayBuffer();
   timings.push(performance.now()-t);statuses.push(response.status);
  }));
 }
 const durationMs=performance.now()-started;
 return {requests,concurrency,durationMs,p50Ms:percentile(timings,.5),p95Ms:percentile(timings,.95),p99Ms:percentile(timings,.99),requestsPerSecond:requests*1000/durationMs,errors:statuses.filter(x=>x!==200).length,statuses};
}
test('R5 bounded authenticated API load evidence is reproducible and fail-closed',async t=>{
 assert.equal(process.env.IWAY_R5_LOCAL_LOAD_OPT_IN,'1','R5 load requires explicit local opt-in');
 const {base,cookie}=await start(t),headers={Cookie:cookie};
 const scenarios=[{path:'/api/ops/state',concurrency:1},{path:'/api/ops/state',concurrency:4},{path:'/api/ops/state',concurrency:8},{path:'/api/ops/state',concurrency:16}];
 const results=[];
 for(const scenario of scenarios){
  for(let i=0;i<5;i++)await fetch(base+scenario.path,{headers});
  const result=await sample(base,scenario.path,headers,40,scenario.concurrency);
  assert.equal(result.requests,40);
  assert.equal(result.errors,0);
  assert.ok(result.p50Ms>0&&result.p95Ms>=result.p50Ms&&result.p99Ms>=result.p95Ms);
  assert.ok(result.requestsPerSecond>0);
  results.push({path:scenario.path,concurrency:scenario.concurrency,...result,statuses:undefined});
 }
 const unauthorized=await sample(base,'/api/ops/state',{},10,2);
 assert.equal(unauthorized.errors,10);
 assert.ok(unauthorized.statuses.every(x=>x===401));
 const evidence={schemaVersion:1,environment:'disposable-local-http-sqlite',source:'makeOperationsApp',authenticated:true,productionSloCertified:false,scenarios:results,unauthorized:{requests:10,expectedStatus:401}};
 if(process.env.IWAY_R5_API_LOAD_REPORT){
  const target=process.env.IWAY_R5_API_LOAD_REPORT;
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(evidence,null,2)+'\n');
 }
 console.log('R5_LOCAL_API_LOAD '+JSON.stringify(evidence));
 assert.equal(evidence.scenarios.length,4);
});
