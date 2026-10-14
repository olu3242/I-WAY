import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OperationsStore} from '../server/operations-store.mjs';
function withStore(onTransactionTiming,fn){
 const dir=mkdtempSync(join(tmpdir(),'iway-transaction-timing-'));
 let store;
 try{store=new OperationsStore(join(dir,'operations.sqlite'),{onTransactionTiming});return fn(store)}
 finally{store?.close();rmSync(dir,{recursive:true,force:true})}
}
test('opt-in timing records transaction phases without exposing business data',()=>{
 const samples=[];
 withStore(sample=>samples.push(sample),store=>{
  assert.equal(store.transaction(()=>42),42);
  assert.equal(samples.length,1);
  assert.equal(samples[0].committed,true);
  for(const key of ['acquireMs','executeMs','finalizeMs'])assert.ok(Number.isFinite(samples[0][key])&&samples[0][key]>=0);
  assert.deepEqual(Object.keys(samples[0]).sort(),['acquireMs','committed','executeMs','finalizeMs','acquired'].sort());
 });
});
test('timing callback failure never changes committed transaction result',()=>{
 withStore(()=>{throw Error('telemetry failure')},store=>{
  assert.equal(store.transaction(()=>store.db.prepare('SELECT 1 AS n').get().n),1);
 });
});
test('failed transaction rolls back and emits noncommitted timing',()=>{
 const samples=[];
 withStore(sample=>samples.push(sample),store=>{
  assert.throws(()=>store.transaction(()=>{
   store.db.exec("CREATE TABLE timing_rollback(value TEXT)");
   store.db.exec("INSERT INTO timing_rollback(value) VALUES ('temporary')");
   throw Error('abort');
  }),/abort/);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='timing_rollback'").get().n,0);
  assert.equal(samples[0].committed,false);
 });
});
test('default transaction behavior remains available without instrumentation',()=>{
 withStore(undefined,store=>assert.equal(store.transaction(()=>true),true));
});
