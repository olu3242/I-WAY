import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assessPerformanceFiles} from '../scripts/operations-assess-performance-series.mjs';

const names=['dispatch','workflow','documents','tenant_isolation'];
const baseline={format:'iway-performance-baseline',version:1,configuration:{workers:4,rounds:6},scenarios:names.map(scenario=>({scenario,budgets:{minThroughputPerSecond:10,p95Ms:750,maxWorkerRssBytes:201326592}}))};
const report=(id,rate=20)=>({format:'iway-performance-evidence',version:1,runId:id,configuration:{workers:4,rounds:6},hostedCertified:false,correctnessPassed:true,scenarios:names.map(scenario=>({scenario,elapsedMs:300,throughputPerSecond:rate,latency:{p95Ms:50},resources:{maxWorkerRssBytes:60000000},outcomes:{unexpectedError:0},invariants:{valid:true}}))});
test('read-only CLI accepts three independent comparable local reports without mutating evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-series-'));
 try{
  const files=['baseline.json','a.json','b.json','c.json'].map(name=>join(dir,name));
  const sources=[baseline,report('a'),report('b'),report('c')].map(JSON.stringify);
  await Promise.all(files.map((file,index)=>writeFile(file,sources[index])));
  const result=await assessPerformanceFiles(files);
  assert.equal(result.status,'LOCAL_REPEAT_PASS');
  assert.equal(result.certificationGranted,false);
  assert.deepEqual(await Promise.all(files.map(file=>readFile(file,'utf8'))),sources);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('read-only CLI does not average away a failed benchmark',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-series-fail-'));
 try{
  const files=['baseline.json','a.json','b.json','c.json'].map(name=>join(dir,name));
  const sources=[baseline,report('a'),report('b',5),report('c')];
  await Promise.all(files.map((file,index)=>writeFile(file,JSON.stringify(sources[index]))));
  const result=await assessPerformanceFiles(files);
  assert.equal(result.status,'LOCAL_REPEAT_FAIL');
  assert.equal(result.scenarios.find(s=>s.scenario==='dispatch').throughputFailures,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('read-only CLI rejects placeholder paths and incomplete arguments',async()=>{
 await assert.rejects(assessPerformanceFiles(['baseline.json']),TypeError);
 await assert.rejects(assessPerformanceFiles(['baseline.json','path/to/run1.json','path/to/run2.json','path/to/run3.json']),{code:'ENOENT'});
});
