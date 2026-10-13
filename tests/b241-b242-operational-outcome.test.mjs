import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyOperationalOutcome} from '../lib/intelligence/operational-outcome.mjs';
const base=()=>({tenantId:'tenant-1',eventId:'event-1',resourceVersion:1,attempt:1,maxAttempts:3,state:'retryable_failure',failureCategory:'TIMEOUT'});
test('B241 bounded telemetry contains no raw tenant or event identity',()=>{
 const result=classifyOperationalOutcome(base());
 assert.equal(result.correlation.length,20);
 assert.equal(JSON.stringify(result).includes('tenant-1'),false);
 assert.equal(JSON.stringify(result).includes('event-1'),false);
 assert.equal(result.executionReceipt,null);
 assert.equal(result.externalDelivery,false);
});
test('B242 transient failure requires external scheduler, never retries directly',()=>{
 const result=classifyOperationalOutcome(base());
 assert.equal(result.retryPermitted,true);
 assert.equal(result.disposition,'RETRY_SCHEDULE_REQUIRED');
 assert.equal(classifyOperationalOutcome({...base(),attempt:3}).disposition,'DEAD_LETTER_REVIEW_REQUIRED');
});
test('B242 permanent failures never retry and require review',()=>{
 const result=classifyOperationalOutcome({...base(),state:'terminal_failure',failureCategory:'AUTHORITY_DENIED'});
 assert.equal(result.retryPermitted,false);
 assert.equal(result.disposition,'DEAD_LETTER_REVIEW_REQUIRED');
});
test('B241 approval and completion never claim external delivery',()=>{
 for(const state of ['approval_required','completed']){
  const result=classifyOperationalOutcome({...base(),state,failureCategory:'NONE'});
  assert.equal(result.externalDelivery,false);
  assert.equal(result.retryPermitted,false);
 }
});
test('B242 rejects unsafe payload, unbounded attempts and invalid retry classification',()=>{
 assert.throws(()=>classifyOperationalOutcome({...base(),secret:'x'}),/OUTCOME_FIELDS/);
 assert.throws(()=>classifyOperationalOutcome({...base(),maxAttempts:999}),/OUTCOME_STATE/);
 assert.throws(()=>classifyOperationalOutcome({...base(),failureCategory:'AUTHORITY_DENIED'}),/OUTCOME_RETRY_CLASS/);
 assert.throws(()=>classifyOperationalOutcome({...base(),state:'completed'}),/OUTCOME_CATEGORY/);
});
