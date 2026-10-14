import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDispatchOrchestration} from '../lib/intelligence/dispatch-orchestration-gate.mjs';
const context=()=>({tenantId:'tenant-1',eventId:'event-1',action:'dispatch:assign',loadId:'load-1',loadVersion:2,principalId:'operator-1',principalActive:true,authorized:true,eligible:true,openExceptions:0,documentReady:true,approvalRecorded:true,confidence:0.99,estimatedCost:0,evidence:['load-v2']});
const policy=()=>({tenantId:'tenant-1',enabled:true,allowedActions:['dispatch:assign','capacity:recommend','exception:recover'],autonomyLevel:3,minimumConfidence:0.8,maximumCost:100,version:2});
test('B236 dispatch requires human approval even with a bounded policy',()=>{
 const result=evaluateDispatchOrchestration(context(),policy());
 assert.equal(result.status,'APPROVAL_REQUIRED');
 assert.equal(result.executionReceipt,null);
});
test('B237 capacity advice cannot bypass current eligibility or principal authority',()=>{
 for(const change of [{eligible:false},{authorized:false},{principalActive:false}]){
  assert.equal(evaluateDispatchOrchestration({...context(),action:'capacity:recommend',...change},policy()).status,'BLOCKED');
 }
});
test('B238 open exception prevents all orchestration; recovery remains approval-required',()=>{
 assert.equal(evaluateDispatchOrchestration({...context(),openExceptions:1},policy()).reason,'OPEN_EXCEPTION');
 assert.equal(evaluateDispatchOrchestration({...context(),action:'exception:recover'},policy()).status,'APPROVAL_REQUIRED');
});
test('B236 document readiness and tenant policy fail closed',()=>{
 assert.equal(evaluateDispatchOrchestration({...context(),documentReady:false},policy()).reason,'DOCUMENT_NOT_READY');
 assert.equal(evaluateDispatchOrchestration(context(),{...policy(),tenantId:'tenant-2'}).status,'BLOCKED');
});
test('B237 advisory is not execution, and malformed evidence is rejected',()=>{
 const result=evaluateDispatchOrchestration({...context(),action:'capacity:recommend'},policy());
 assert.equal(result.status,'ELIGIBLE_FOR_ADVISORY');
 assert.equal(result.executionReceipt,null);
 assert.throws(()=>evaluateDispatchOrchestration({...context(),extra:'unsafe'},policy()),/DISPATCH_FIELDS/);
});
