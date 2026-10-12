import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransactionTimingCollector} from '../domain/operations-transaction-timing.mjs';
test('bounded timing aggregation never exposes caller-supplied identities',()=>{
 const collector=createTransactionTimingCollector({maxSamples:2});
 for(let i=1;i<=3;i++)assert.equal(collector.record({acquireMs:i,executeMs:i*2,finalizeMs:i*3,committed:i!==3,tenantId:'must-not-appear',sql:'secret'}),true);
 const result=collector.snapshot();
 assert.equal(result.observed,3);
 assert.equal(result.sampled,2);
 assert.equal(result.truncated,true);
 assert.equal(result.rolledBack,1);
 assert.equal(result.phases.acquireMs.p95Ms,2);
 assert.equal(JSON.stringify(result).includes('must-not-appear'),false);
 assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('rejects invalid telemetry and sample bounds',()=>{
 assert.throws(()=>createTransactionTimingCollector({maxSamples:0}),RangeError);
 const collector=createTransactionTimingCollector();
 assert.equal(collector.record({acquireMs:NaN,executeMs:0,finalizeMs:0,committed:true}),false);
 assert.equal(collector.snapshot().observed,0);
 assert.equal(collector.snapshot().phases.acquireMs.p95Ms,null);
});
