import test from 'node:test';
import assert from 'node:assert/strict';
import {runLocalTransactionProbe} from '../scripts/operations-transaction-probe.mjs';
test('isolated synthetic probe preserves transaction integrity and bounded numeric output',()=>{
 const result=runLocalTransactionProbe({iterations:3});
 assert.equal(result.integrityPassed,true);
 assert.equal(result.certification,false);
 assert.equal(result.timing.observed,3);
 assert.equal(result.timing.committed,3);
 assert.equal(result.timing.rolledBack,0);
 assert.equal(result.timing.sampled,3);
 assert.equal(result.timing.phases.acquireMs.p95Ms>=0,true);
 assert.equal(JSON.stringify(result).includes('tenantId'),false);
});
test('probe rejects unsafe iteration counts',()=>{
 assert.throws(()=>runLocalTransactionProbe({iterations:0}),RangeError);
 assert.throws(()=>runLocalTransactionProbe({iterations:101}),RangeError);
});
