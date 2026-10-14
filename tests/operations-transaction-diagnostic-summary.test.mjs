import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTransactionDiagnostics} from '../domain/operations-transaction-diagnostic-summary.mjs';

const names=['dispatch','workflow','documents','tenant_isolation'];
const worker=()=>({format:'iway-transaction-phase-diagnostics',version:1,observed:2,committed:1,rolledBack:1,sampled:2,truncated:false,phases:Object.fromEntries(['acquireMs','executeMs','finalizeMs'].map(k=>[k,{p50Ms:1,p95Ms:2,maxMs:3}]))});
const report=()=>({format:'iway-performance-evidence',diagnosticOnly:true,certificationComparable:false,certificationStatus:'NOT_EVALUATED',runId:'synthetic',scenarios:names.map(scenario=>({scenario,concurrency:2,transactionDiagnostics:{workers:[worker(),worker()]}}))});
test('summarizes opt-in worker phase evidence without declaring performance certification',()=>{
 const result=summarizeTransactionDiagnostics(report());
 assert.equal(result.certified,false);assert.equal(result.rootCauseEstablished,false);
 assert.equal(result.scenarios.length,4);assert.equal(result.scenarios[0].transactions.observed,4);
 assert.equal(result.scenarios[0].workerPhaseP95Ms.acquireMs.maximum,2);
 assert.equal(JSON.stringify(result).includes('synthetic'),true);
});
test('rejects non-diagnostic evidence, missing workers and duplicate scenarios',()=>{
 for(const mutate of [r=>{r.diagnosticOnly=false},r=>{r.certificationComparable=true},r=>{r.scenarios[0].transactionDiagnostics.workers=[]},r=>{r.scenarios[1].scenario='dispatch'}]){
  const r=report();mutate(r);assert.throws(()=>summarizeTransactionDiagnostics(r),TypeError);
 }
});
test('rejects inconsistent counts, percentiles and invalid numeric values',()=>{
 for(const mutate of [w=>{w.committed=3},w=>{w.phases.acquireMs.p95Ms=NaN},w=>{w.phases.executeMs.p95Ms=0},w=>{w.sampled=3},w=>{w.truncated=true}]){
  const r=report();mutate(r.scenarios[0].transactionDiagnostics.workers[0]);assert.throws(()=>summarizeTransactionDiagnostics(r),TypeError);
 }
});
test('summary excludes unexpected source fields and protected metadata',()=>{
 const r=report();r.scenarios[0].transactionDiagnostics.workers[0].tenantId='PRIVATE_TENANT';
 r.scenarios[0].transactionDiagnostics.workers[0].sql='PRIVATE_SQL';
 const result=JSON.stringify(summarizeTransactionDiagnostics(r));
 assert.equal(result.includes('PRIVATE_TENANT'),false);assert.equal(result.includes('PRIVATE_SQL'),false);
});
