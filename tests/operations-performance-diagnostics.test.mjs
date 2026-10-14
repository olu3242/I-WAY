import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosePerformanceReport} from '../domain/operations-performance-diagnostics.mjs';
const baseline={scenarios:[{scenario:'dispatch',budgets:{p95Ms:750,minThroughputPerSecond:10.79}}]};
const report={format:'iway-performance-evidence',runId:'fixture',configuration:{workers:4,rounds:6},scenarios:[
 {scenario:'dispatch',startupMs:400,elapsedMs:2000,work:10,throughputPerSecond:5,latency:{p95Ms:830},resources:{workerUserCpuMs:120,workerSystemCpuMs:40}}
]};
test('reports original gate failures without recalibration',()=>{
 const result=diagnosePerformanceReport(report,baseline);
 assert.equal(result.scenarios[0].throughputPassed,false);
 assert.equal(result.scenarios[0].latencyPassed,false);
 assert.equal(result.scenarios[0].throughputConsistent,true);
 assert.equal(result.scenarios[0].workerStartupMs,400);
 assert.match(result.conclusion,/Root cause not established/);
 assert.equal(baseline.scenarios[0].budgets.minThroughputPerSecond,10.79);
});
test('does not infer missing acceptance budgets as passing',()=>{
 const result=diagnosePerformanceReport(report,{scenarios:[]});
 assert.equal(result.scenarios[0].latencyPassed,null);
 assert.equal(result.scenarios[0].throughputPassed,null);
});
test('detects inconsistent elapsed-time throughput evidence',()=>{
 const result=diagnosePerformanceReport({...report,scenarios:[{...report.scenarios[0],throughputPerSecond:50}]},baseline);
 assert.equal(result.allMeasurementsConsistent,false);
});
test('rejects malformed measurements',()=>{
 assert.throws(()=>diagnosePerformanceReport({format:'invalid',scenarios:[]}),TypeError);
 assert.throws(()=>diagnosePerformanceReport({...report,scenarios:[{...report.scenarios[0],elapsedMs:-1}]},baseline),TypeError);
});
