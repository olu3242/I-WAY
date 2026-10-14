import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fork} from 'node:child_process';
import {OperationsStore} from '../server/operations-store.mjs';
import {createTransactionTimingCollector} from '../domain/operations-transaction-timing.mjs';
async function stores(t){const root=await mkdtemp(join(tmpdir(),'iway-contention-regression-')),path=join(root,'test.sqlite'),samples=[],collector=createTransactionTimingCollector(),a=new OperationsStore(path),b=new OperationsStore(path,{onTransactionTiming:s=>{samples.push(s);collector.record(s)}});t.after(async()=>{a.close();b.close();await rm(root,{recursive:true,force:true})});return {path,a,b,samples,collector}}
test('lock acquisition timeout is bounded, never executes callback, and is not a rollback or execution sample',async t=>{
 const {a,b,samples,collector}=await stores(t);b.db.exec('PRAGMA busy_timeout=25');a.db.exec('BEGIN IMMEDIATE');let calls=0;
 try{for(let attempt=0;attempt<3;attempt++)assert.throws(()=>b.transaction(()=>calls++));}finally{a.db.exec('ROLLBACK')}
 assert.equal(calls,0);assert.equal(samples.length,3);for(const sample of samples){assert.equal(sample.acquired,false);assert.equal(sample.committed,false);assert.ok(sample.acquireMs>=10);assert.equal(sample.executeMs,0);assert.equal(sample.finalizeMs,0)}
 assert.equal(collector.snapshot().acquisitionFailures,3);assert.equal(collector.snapshot().rolledBack,0);assert.equal(b.transaction(()=>42),42);
});
test('interrupted SQLite writer loses no committed state and leaves no partial write',async t=>{
 const {a,path}=await stores(t);a.db.exec('CREATE TABLE interruption_probe(value INTEGER); INSERT INTO interruption_probe VALUES(0)');
 const child=fork(new URL('./helpers/operations-interrupted-worker.mjs',import.meta.url),[path],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker readiness timeout')),10000);child.once('message',()=>{clearTimeout(timer);resolve()});child.once('error',reject)});const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed;assert.equal(a.db.prepare('SELECT value FROM interruption_probe').get().value,0);a.transaction(()=>a.db.exec('UPDATE interruption_probe SET value=2'));assert.equal(a.db.prepare('SELECT value FROM interruption_probe').get().value,2);}finally{if(child.exitCode===null&&child.signalCode===null){const closed=new Promise(resolve=>child.once('exit',resolve));child.kill();await closed}}
});
