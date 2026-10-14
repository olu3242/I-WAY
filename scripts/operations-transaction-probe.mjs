// Explicit opt-in local SQLite contention probe. Not part of certification benchmark.
// Uses synthetic records only and does not change durability, thresholds, or application data.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {OperationsStore} from '../server/operations-store.mjs';
import {createTransactionTimingCollector} from '../domain/operations-transaction-timing.mjs';
export function runLocalTransactionProbe({iterations=20}={}){
 if(!Number.isInteger(iterations)||iterations<1||iterations>100)throw new RangeError('Iterations must be 1–100');
 const root=mkdtempSync(join(tmpdir(),'iway-transaction-probe-')),collector=createTransactionTimingCollector({maxSamples:iterations}),started=performance.now();
 let store;
 try{
  store=new OperationsStore(join(root,'operations.sqlite'),{onTransactionTiming:sample=>collector.record(sample)});
  store.db.exec('CREATE TABLE IF NOT EXISTS probe_values (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)');
  for(let i=0;i<iterations;i++)store.transaction(()=>store.db.prepare('INSERT INTO probe_values(value) VALUES(?)').run(i));
  const count=store.db.prepare('SELECT count(*) AS n FROM probe_values').get().n;
  if(count!==iterations)throw new Error('Probe integrity check failed');
  return {format:'iway-local-transaction-probe',version:1,scope:'Synthetic isolated SQLite transactions; no concurrency or hosted capacity claim',
   iterations,wallElapsedMs:performance.now()-started,integrityPassed:true,timing:collector.snapshot(),certification:false};
 }finally{try{store?.close()}finally{rmSync(root,{recursive:true,force:true})}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv.length!==2)throw new Error('Unexpected arguments');console.log(JSON.stringify(runLocalTransactionProbe(),null,2))}
 catch{console.error(JSON.stringify({status:'FAIL',reason:'LOCAL_TRANSACTION_PROBE_FAILED'}));process.exitCode=1}
}
