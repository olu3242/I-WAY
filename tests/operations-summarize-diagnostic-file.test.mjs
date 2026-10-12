import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {summarizeDiagnosticFile} from '../scripts/operations-summarize-diagnostic-file.mjs';

const names=['dispatch','workflow','documents','tenant_isolation'];
const diagnostic=()=>({
 format:'iway-performance-evidence',diagnosticOnly:true,certificationComparable:false,
 certificationStatus:'NOT_EVALUATED',runId:'diagnostic-test',
 scenarios:names.map(scenario=>({scenario,concurrency:2,transactionDiagnostics:{workers:Array.from({length:2},()=>({
  format:'iway-transaction-phase-diagnostics',version:1,observed:1,committed:1,rolledBack:0,
  sampled:1,truncated:false,phases:Object.fromEntries(['acquireMs','executeMs','finalizeMs'].map(name=>[name,{p50Ms:2,p95Ms:2,maxMs:2}]))
 }))}}))
});
test('diagnostic summary preserves source and writes a new optional output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-summary-cli-'));
 try{
  const input=join(dir,'diagnostic.json'),output=join(dir,'summary.json');
  const original=JSON.stringify(diagnostic());await writeFile(input,original);
  const result=await summarizeDiagnosticFile([input,output]);
  assert.equal(result.format,'iway-transaction-diagnostic-summary');
  assert.equal(result.certified,false);assert.equal(result.rootCauseEstablished,false);
  assert.equal(result.scenarios.length,4);
  assert.equal(await readFile(input,'utf8'),original);
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')),result);
  await assert.rejects(summarizeDiagnosticFile([input,output]),{code:'EEXIST'});
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('diagnostic summary rejects missing path, normal benchmark, and invalid arguments',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'iway-summary-invalid-'));
 try{
  const input=join(dir,'ordinary.json');
  await writeFile(input,JSON.stringify({format:'iway-performance-evidence',status:'PASS',scenarios:[]}));
  await assert.rejects(summarizeDiagnosticFile([]),TypeError);
  await assert.rejects(summarizeDiagnosticFile([input]),TypeError);
  await assert.rejects(summarizeDiagnosticFile([join(dir,'missing.json')]),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true})}
});
