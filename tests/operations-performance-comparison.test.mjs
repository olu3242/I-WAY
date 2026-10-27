import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerformanceRuns} from '../domain/operations-performance-comparison.mjs';
const baseline={scenarios:[{scenario:'dispatch',budgets:{p95Ms:750,minThroughputPerSecond:10.79}}]};
const make=(runId,throughput,elapsedMs,p95Ms)=>({format:'iway-performance-evidence',runId,configuration:{workers:4,rounds:6},scenarios:[{scenario:'dispatch',startupMs:200,elapsedMs,work:10,throughputPerSecond:throughput,latency:{p95Ms},resources:{workerUserCpuMs:10,workerSystemCpuMs:5}}]});
test('compares repeat regression against unchanged acceptance budgets',()=>{
 const initial=make('initial',10,1000,490),repeat=make('repeat',5,2000,830);
 const result=comparePerformanceRuns(initial,repeat,baseline);
 assert.equal(result.scenarios[0].throughputChangePercent,-50);
 assert.equal(result.scenarios[0].repeatThroughputPassed,false);
 assert.equal(result.scenarios[0].repeatLatencyPassed,false);
 assert.equal(result.allThroughputRegressed,true);
 assert.equal(result.certified,false);
 assert.equal(baseline.scenarios[0].budgets.minThroughputPerSecond,10.79);
});
test('refuses mismatched workloads',()=>{
 assert.throws(()=>comparePerformanceRuns(make('a',10,1000,490),{...make('b',5,2000,830),configuration:{workers:2,rounds:6}},baseline),/workloads differ/);
});
test('refuses missing or duplicated scenarios',()=>{
 const initial=make('a',10,1000,490),repeat=make('b',5,2000,830);
 assert.throws(()=>comparePerformanceRuns(initial,{...repeat,scenarios:[]},baseline),/Scenario sets differ/);
 assert.throws(()=>comparePerformanceRuns(initial,{...repeat,scenarios:[repeat.scenarios[0],repeat.scenarios[0]]},baseline),/Scenario sets differ/);
});
test('marks inconsistent reported throughput without changing it',()=>{
 const result=comparePerformanceRuns(make('a',10,1000,490),make('b',50,2000,830),baseline);
 assert.equal(result.scenarios[0].throughputEvidenceConsistent,false);
});
