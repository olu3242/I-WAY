import test from 'node:test';
import assert from 'node:assert/strict';
import {runPerformanceScenarios,calibratePerformance,evaluatePerformance} from '../scripts/operations-benchmark.mjs';

test('independent concurrent workers exercise dispatch, workflows, documents and tenant isolation with measured resources',async()=>{
 const report=await runPerformanceScenarios({workers:2,rounds:2});
 assert.equal(report.correctnessPassed,true);assert.equal(report.scenarios.length,4);assert.equal(report.hostedCertified,false);
 for(const scenario of report.scenarios){
  assert.equal(scenario.concurrency,2);assert.ok(scenario.latency.samples>=4);assert.ok(scenario.latency.p95Ms>=0);assert.ok(scenario.elapsedMs>0);assert.ok(scenario.throughputPerSecond>0);
  assert.equal(scenario.outcomes.unexpectedError,0);assert.ok(Object.values(scenario.invariants).every(Boolean));assert.ok(scenario.resources.maxWorkerRssBytes>0);
 }
 const dispatch=report.scenarios.find(s=>s.scenario==='dispatch');assert.equal(dispatch.outcomes.success,2);assert.equal(dispatch.outcomes.expectedConflict,2);
 const runtime=report.scenarios.find(s=>s.scenario==='workflow');assert.equal(runtime.work,10);
 const baseline=calibratePerformance(report);
 assert.equal(evaluatePerformance(report,baseline).status,'FAIL','Calibration must never certify itself');
 const independentFixture={...report,runId:'independent-unit-fixture'};
 assert.equal(evaluatePerformance(independentFixture,baseline).status,'PASS');
 const regression=structuredClone(independentFixture);regression.scenarios[0].latency.p95Ms=baseline.scenarios[0].budgets.p95Ms+1;
 assert.equal(evaluatePerformance(regression,baseline).status,'FAIL','An actual limit violation must fail evaluation');
 const leak=structuredClone(independentFixture);leak.scenarios[3].invariants.allCrossTenantRequestsDenied=false;
 assert.equal(evaluatePerformance(leak,baseline).status,'FAIL','Isolation failures must fail regardless of throughput');
});
