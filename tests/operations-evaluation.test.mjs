import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {runOfflineEvaluation,deterministicEvaluationAdapter,offlineEvaluationCases,summarizeEvaluationResults} from '../domain/operations-evaluation.mjs';
test('B48 offline evaluation executes actual four-domain fixture cases with independent evidence and honest unavailable model metrics',async()=>{
 const report=await runOfflineEvaluation({createFixture:fixture});
 assert.equal(report.localStatus,'PASS');assert.equal(report.summary.total,12);assert.equal(report.summary.passed,12);assert.equal(report.summary.failed,0);
 assert.equal(report.summary.labelAccuracy,1);assert.equal(report.summary.policyCompliance,1);assert.ok(report.summary.latencyMs.p95>=0);
 assert.deepEqual(Object.keys(report.categories),['dispatch','document','exception','finance']);
 assert.ok(report.results.every(row=>row.latencyMs>=0&&row.setupMs>0&&row.model===null&&row.costEstimateUSD===null));
 assert.equal(report.modelEvaluation.status,'BLOCKED');assert.equal(report.modelEvaluation.accuracy,null);assert.equal(report.summary.modelInferenceCount,0);assert.equal(report.summary.inferenceCostEstimateUSD,null);
 assert.equal(report.results.find(row=>row.id==='document-provider-failure').actualLabel,'fallback_requires_review');
 assert.equal(report.results.find(row=>row.id==='dispatch-unapproved-apply').actualLabel,'policy_denied');
});
test('B48 evaluation cannot turn self-reported adapter policy labels into a PASS without durable domain evidence',async()=>{
 const fake={...deterministicEvaluationAdapter,provider:'isolated-untrusted-fixture',evaluate:definition=>({label:definition.expectedLabel,policyChecks:[true],provenance:{model:null,live:false},costEstimateUSD:null})};
 const report=await runOfflineEvaluation({createFixture:fixture,adapter:fake});
 assert.equal(report.summary.labelAccuracy,1);assert.equal(report.summary.policyCompliance,0);assert.equal(report.localStatus,'FAIL');assert.equal(report.summary.failed,12);
});
test('B48 evaluation isolates provider failures, redacts raw diagnostics, and keeps coverage in the denominator',async()=>{
 const marker='SYNTHETIC-PRIVATE-EVALUATION-ERROR';
 const broken={...deterministicEvaluationAdapter,evaluate:()=>{throw new Error(marker)}};
 const report=await runOfflineEvaluation({createFixture:fixture,adapter:broken});
 assert.equal(report.summary.total,offlineEvaluationCases.length);assert.equal(report.summary.failed,12);assert.equal(report.summary.skipped,0);assert.equal(report.localStatus,'FAIL');
 assert.ok(report.results.every(row=>row.errorCategory==='ENGINE_FAILURE'));assert.ok(!JSON.stringify(report).includes(marker));
 await assert.rejects(()=>runOfflineEvaluation({createFixture:fixture,adapter:{...broken,mode:'live',model:'unapproved-model'}}),error=>error.code==='EVALUATION_PROVIDER_BLOCKED');
});
test('B48 summary measures imperfect results rather than rounding failures into a passing accuracy',()=>{
 const summary=summarizeEvaluationResults([{correct:true,policyCompliant:true,passed:true,latencyMs:2},{correct:false,policyCompliant:false,passed:false,latencyMs:7}]);
 assert.equal(summary.labelAccuracy,0.5);assert.equal(summary.policyCompliance,0.5);assert.equal(summary.failed,1);assert.equal(summary.latencyMs.p95,7);
});
