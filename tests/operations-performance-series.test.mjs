import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPerformanceSeries} from '../domain/operations-performance-series.mjs';
const names=['dispatch','workflow','documents','tenant_isolation'];
const baseline={format:'iway-performance-baseline',version:1,configuration:{workers:4,rounds:6},scenarios:names.map(scenario=>({scenario,budgets:{minThroughputPerSecond:10,p95Ms:750,maxWorkerRssBytes:201326592}}))};
const report=(runId,rate=20)=>({format:'iway-performance-evidence',version:1,runId,configuration:{workers:4,rounds:6},hostedCertified:false,correctnessPassed:true,scenarios:names.map(scenario=>({scenario,elapsedMs:300,throughputPerSecond:rate,latency:{p95Ms:50},resources:{maxWorkerRssBytes:60000000},outcomes:{unexpectedError:0},invariants:{valid:true}}))});
test('all independent passing runs yield local-only repeat PASS',()=>{
 const result=assessPerformanceSeries([report('a'),report('b'),report('c')],baseline);
 assert.equal(result.status,'LOCAL_REPEAT_PASS');assert.equal(result.hostedCertified,false);assert.equal(result.certificationGranted,false);
});
test('any failed run remains a repeat FAIL and is never averaged away',()=>{
 const result=assessPerformanceSeries([report('a'),report('b',9),report('c')],baseline);
 assert.equal(result.status,'LOCAL_REPEAT_FAIL');assert.equal(result.scenarios[0].throughputFailures,1);
});
test('reject duplicate runs, diagnostic-only runs, workload mismatches and missing evidence',()=>{
 assert.throws(()=>assessPerformanceSeries([report('a'),report('a'),report('c')],baseline),TypeError);
 const diag=report('b');diag.diagnosticOnly=true;
 assert.throws(()=>assessPerformanceSeries([report('a'),diag,report('c')],baseline),TypeError);
 const wrong=report('b');wrong.configuration.rounds=7;
 assert.throws(()=>assessPerformanceSeries([report('a'),wrong,report('c')],baseline),TypeError);
 assert.throws(()=>assessPerformanceSeries([report('a'),report('b')],baseline),TypeError);
});
test('reject falsified or incomplete scenario results',()=>{
 const bad=report('b');bad.scenarios[0].invariants.valid=false;
 assert.equal(assessPerformanceSeries([report('a'),bad,report('c')],baseline).status,'LOCAL_REPEAT_FAIL');
 const duplicate=report('b');duplicate.scenarios[1].scenario='dispatch';
 assert.throws(()=>assessPerformanceSeries([report('a'),duplicate,report('c')],baseline),TypeError);
});
