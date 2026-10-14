import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTransactionDiagnostics} from '../domain/operations-transaction-diagnostic-comparison.mjs';
const names=['dispatch','workflow','documents','tenant_isolation'];
const worker=p=>({format:'iway-transaction-phase-diagnostics',version:1,observed:2,committed:2,rolledBack:0,sampled:2,truncated:false,phases:Object.fromEntries(['acquireMs','executeMs','finalizeMs'].map(k=>[k,{p50Ms:p,p95Ms:p,maxMs:p}]))});
const run=(id,p)=>({format:'iway-performance-evidence',diagnosticOnly:true,certificationComparable:false,certificationStatus:'NOT_EVALUATED',runId:id,configuration:{workers:2,rounds:6},scenarios:names.map(scenario=>({scenario,concurrency:2,transactionDiagnostics:{workers:[worker(p),worker(p)]}}))});
test('compares bounded worker p95 without certifying or asserting contention',()=>{
 const result=compareTransactionDiagnostics(run('first',2),run('second',3));
 assert.equal(result.certified,false);assert.equal(result.rootCauseEstablished,false);
 assert.equal(result.scenarios.length,4);
 assert.equal(result.scenarios[0].phases.acquireMs.changePercent,50);
});
test('requires distinct runs and identical configurations',()=>{
 assert.throws(()=>compareTransactionDiagnostics(run('same',2),run('same',3)),TypeError);
 const other=run('other',3);other.configuration.rounds=7;
 assert.throws(()=>compareTransactionDiagnostics(run('first',2),other),TypeError);
});
test('rejects invalid or uncertified-source-shaped diagnostic evidence',()=>{
 const invalid=run('second',3);invalid.diagnosticOnly=false;
 assert.throws(()=>compareTransactionDiagnostics(run('first',2),invalid),TypeError);
});
