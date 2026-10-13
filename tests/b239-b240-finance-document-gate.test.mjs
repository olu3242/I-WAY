import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFinanceDocumentGate} from '../lib/intelligence/finance-document-gate.mjs';

const valid=()=>({
 tenantId:'tenant-1',loadId:'load-1',loadVersion:3,action:'invoice:prepare',
 principalId:'carrier-1',authorized:true,loadDelivered:true,bolValidated:true,
 podAcknowledged:true,documentIntegrity:true,documentReviewCurrent:true,
 financialApproval:true,invoiceAlreadyIssued:false,evidenceDigest:'a'.repeat(64)
});

test('B239 eligible invoice remains human workflow only',()=>{
 const result=evaluateFinanceDocumentGate(valid());
 assert.equal(result.status,'ELIGIBLE_FOR_HUMAN_WORKFLOW');
 assert.equal(result.executionReceipt,null);
 assert.equal(result.externalDelivery,false);
 assert.ok(Object.isFrozen(result));
});

test('B239 delivery, POD, approval and duplicate invoice block',()=>{
 const cases=[
  [{loadDelivered:false},'SHIPMENT_NOT_DELIVERED'],
  [{podAcknowledged:false},'POD_MISSING'],
  [{financialApproval:false},'FINANCIAL_APPROVAL_REQUIRED'],
  [{invoiceAlreadyIssued:true},'INVOICE_EXISTS']
 ];
 for(const [change,reason] of cases){
  assert.equal(evaluateFinanceDocumentGate({...valid(),...change}).reason,reason);
 }
});

test('B240 invalid document evidence blocks both actions',()=>{
 for(const action of ['invoice:prepare','document:advance']){
  for(const change of [{documentIntegrity:false},{documentReviewCurrent:false},{bolValidated:false}]){
   assert.equal(evaluateFinanceDocumentGate({...valid(),action,...change}).status,'BLOCKED');
  }
 }
});

test('B239 and B240 replay identity binds version and evidence',()=>{
 const first=evaluateFinanceDocumentGate(valid());
 assert.equal(first.idempotencyKey,evaluateFinanceDocumentGate(valid()).idempotencyKey);
 assert.notEqual(first.idempotencyKey,evaluateFinanceDocumentGate({...valid(),loadVersion:4}).idempotencyKey);
 assert.notEqual(first.idempotencyKey,evaluateFinanceDocumentGate({...valid(),evidenceDigest:'b'.repeat(64)}).idempotencyKey);
});

test('B239 and B240 invalid authority or unexpected input denied',()=>{
 assert.equal(evaluateFinanceDocumentGate({...valid(),authorized:false}).reason,'AUTHORITY_DENIED');
 assert.throws(()=>evaluateFinanceDocumentGate({...valid(),financialApproval:'yes'}),/WORKFLOW_FLAGS/);
 assert.throws(()=>evaluateFinanceDocumentGate({...valid(),unexpected:'value'}),/WORKFLOW_FIELDS/);
});
