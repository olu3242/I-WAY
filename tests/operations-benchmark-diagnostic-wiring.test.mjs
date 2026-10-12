import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const source=await readFile(fileURLToPath(new URL('../scripts/operations-benchmark.mjs',import.meta.url)),'utf8');

test('benchmark transaction diagnostics require explicit opt-in',()=>{
 assert.match(source,/transactionDiagnostics=false/);
 assert.match(source,/task\.transactionDiagnostics===true/);
 assert.match(source,/createTransactionTimingCollector\(\)/);
 assert.match(source,/onTransactionTiming:sample=>collector\.record\(sample\)/);
});

test('diagnostic CLI cannot overwrite certification evidence or recalibrate thresholds',()=>{
 assert.match(source,/--diagnose-transactions/);
 assert.match(source,/performance-diagnostic-.*report\.runId/);
 assert.match(source,/certificationComparable:false/);
 assert.match(source,/certificationStatus:'NOT_EVALUATED'/);
 assert.match(source,/flag:'wx'/);
 assert.match(source,/PERFORMANCE_BASELINE\.json/);
 assert.match(source,/evaluatePerformance\(report,baseline\)/);
});

test('each benchmark scenario receives opt-in instrumentation',()=>{
 for(const name of ['dispatch','workflow','documents','tenant_isolation']){
  assert.match(source,new RegExp("executeWorkers\\(f\\.root,'"+name+"'"));
 }
 assert.match(source,/const documents=await executeWorkers\(f\.root,'documents',documentTasks,transactionDiagnostics\)/);
 assert.match(source,/transactionDiagnostics:timing/);
});
