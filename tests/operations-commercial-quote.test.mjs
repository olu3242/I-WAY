import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCommercialQuote,evaluateQuoteConversion} from '../domain/operations-commercial-quote.mjs';
const validUntil='2099-01-01T00:00:00.000Z';
const input={customerId:'customer-1',reference:'Q-101',currency:'USD',rateCents:10000,charges:[{label:'Fuel',amountCents:2500}],validUntil};
const actor={id:'user-1',tenantId:'tenant-a',active:true};
const customer={id:'customer-1',tenantId:'tenant-a',active:true};
const quote={...normalizeCommercialQuote(input),id:'quote-1',tenantId:'tenant-a',version:1,status:'approved',approvedBy:'reviewer-2'};
test('quote calculates integer-cent total',()=>assert.equal(normalizeCommercialQuote(input).totalCents,12500));
test('quote rejects unexpected fields and non-integer amounts',()=>{
 assert.throws(()=>normalizeCommercialQuote({...input,tenantId:'tenant-b'}),{code:'INVALID_FIELDS'});
 assert.throws(()=>normalizeCommercialQuote({...input,rateCents:1.5}),{code:'INVALID_QUOTE'});
});
test('quote rejects invalid charges and overflow',()=>{
 assert.throws(()=>normalizeCommercialQuote({...input,charges:[{label:'Fuel',amountCents:-1}]}),{code:'INVALID_CHARGES'});
 assert.throws(()=>normalizeCommercialQuote({...input,rateCents:100000000000}),{code:'INVALID_TOTAL'});
});
test('approved quote can be evaluated without side effects',()=>{
 const result=evaluateQuoteConversion({quote,actor,customer,now:new Date('2026-01-01T00:00:00.000Z')});
 assert.equal(result.eligible,true);assert.equal(result.totalCents,12500);assert.equal(result.tenantId,'tenant-a');
});
test('cross-tenant customer and quote are denied',()=>{
 assert.throws(()=>evaluateQuoteConversion({quote,actor,customer:{...customer,tenantId:'tenant-b'}}),{code:'FORBIDDEN'});
 assert.throws(()=>evaluateQuoteConversion({quote:{...quote,tenantId:'tenant-b'},actor,customer}),{code:'FORBIDDEN'});
});
test('unapproved, self-approved, and expired quotes cannot convert',()=>{
 assert.throws(()=>evaluateQuoteConversion({quote:{...quote,status:'draft'},actor,customer}),{code:'APPROVAL_REQUIRED'});
 assert.throws(()=>evaluateQuoteConversion({quote:{...quote,approvedBy:actor.id},actor,customer}),{code:'APPROVAL_REQUIRED'});
 assert.throws(()=>evaluateQuoteConversion({quote:{...quote,validUntil:'2020-01-01T00:00:00.000Z'},actor,customer}),{code:'QUOTE_EXPIRED'});
});
test('tampered quote total is denied',()=>assert.throws(()=>evaluateQuoteConversion({quote:{...quote,totalCents:1},actor,customer}),{code:'TOTAL_MISMATCH'}));
