import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OperationsStore} from '../server/operations-store.mjs';

test('bounded runnable-job SQL preserves pending/retry/expired-lease semantics and tenant isolation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-runtime-selection-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const tenant=randomUUID(),other=randomUUID(),now='2026-10-12T00:00:00.000Z';
  for(const id of [tenant,other])store.db.prepare('INSERT INTO tenants(id,name,timezone) VALUES(?,?,?)').run(id,'Test','UTC');
  const add=(tenantId,status,nextAttemptAt=null,leaseUntil=null)=>store.insert('orchestration',tenantId,{status,nextAttemptAt,leaseUntil});
  for(let i=0;i<25;i++)add(tenant,'completed');
  for(let i=0;i<23;i++)add(tenant,'pending');
  add(tenant,'retry','2026-10-11T23:59:59.000Z');add(tenant,'retry','2026-10-13T00:00:00.000Z');
  add(tenant,'running',null,'2026-10-11T23:59:59.000Z');add(tenant,'running',null,'2026-10-13T00:00:00.000Z');
  add(other,'pending');
  const old=store.list('orchestration',tenant).filter(j=>j.status==='pending'||j.status==='retry'&&j.nextAttemptAt<=now||j.status==='running'&&j.leaseUntil<=now).slice(0,20);
  const sql=`SELECT data FROM resources WHERE kind=? AND tenant_id=? AND (json_extract(data,'$.status')='pending' OR (json_extract(data,'$.status')='retry' AND json_extract(data,'$.nextAttemptAt')<=?) OR (json_extract(data,'$.status')='running' AND json_extract(data,'$.leaseUntil')<=?)) ORDER BY rowid LIMIT 20`;
  const actual=store.db.prepare(sql).all('orchestration',tenant,now,now).map(r=>JSON.parse(r.data));
  assert.deepEqual(actual.map(r=>r.id),old.map(r=>r.id));
  assert.equal(actual.length,20);
  assert.equal(actual.every(r=>r.tenantId===tenant),true);
  const next=store.db.prepare(sql).all('orchestration',other,now,now).map(r=>JSON.parse(r.data));
  assert.equal(next.length,1);assert.equal(next[0].tenantId,other);
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
