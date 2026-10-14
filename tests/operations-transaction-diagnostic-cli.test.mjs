import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compareTransactionDiagnosticFiles} from '../scripts/operations-compare-transaction-diagnostics.mjs';

const names=['dispatch','workflow','documents','tenant_isolation'];
const run=(id,p)=>({format:'iway-performance-evidence',diagnosticOnly:true,certificationComparable:false,certificationStatus:'NOT_EVALUATED',runId:id,configuration:{workers:2,rounds:6},scenarios:names.map(scenario=>({scenario,concurrency:2,transactionDiagnostics:{workers:Array.from({length:2},()=>({format:'iway-transaction-phase-diagnostics',version:1,observed:1,committed:1,rolledBack:0,sampled:1,truncated:false,phases:Object.fromEntries(['acquireMs','executeMs','finalizeMs'].map(k=>[k,{p50Ms:p,p95Ms:p,maxMs:p}]))}))}}))});
test('offline comparison writes only a new result and preserves inputs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-compare-diagnostic-'));
 try{
  const first=join(dir,'first.json'),second=join(dir,'second.json'),output=join(dir,'comparison.json');
  const initial=JSON.stringify(run('a',2)),repeat=JSON.stringify(run('b',3));
  await writeFile(first,initial);await writeFile(second,repeat);
  const result=await compareTransactionDiagnosticFiles([first,second,output]);
  assert.equal(result.certified,false);assert.equal(result.scenarios.length,4);
  assert.equal(await readFile(first,'utf8'),initial);assert.equal(await readFile(second,'utf8'),repeat);
  assert.equal(JSON.parse(await readFile(output,'utf8')).format,'iway-transaction-diagnostic-comparison');
  await assert.rejects(compareTransactionDiagnosticFiles([first,second,output]),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('rejects invalid evidence and mismatched workloads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-compare-invalid-'));
 try{
  const first=join(dir,'a.json'),second=join(dir,'b.json');
  await writeFile(first,JSON.stringify(run('a',2)));
  const invalid=run('b',3);invalid.configuration.rounds=7;await writeFile(second,JSON.stringify(invalid));
  await assert.rejects(compareTransactionDiagnosticFiles([first,second]),TypeError);
 }finally{await rm(dir,{recursive:true,force:true})}
});
