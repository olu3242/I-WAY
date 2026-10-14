import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OperationsStore} from '../server/operations-store.mjs';

test('document shipment lookup indexes exist and query plans use them',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-document-index-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const indexes=store.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(x=>x.name);
  for(const name of ['document_by_shipment','pod_by_shipment','open_document_exception_by_shipment'])assert.ok(indexes.includes(name),name);
  const t=randomUUID(),l=randomUUID();
  const plans=[
   ["SELECT data FROM resources WHERE kind='document' AND tenant_id=? AND json_extract(data,'$.loadId')=? ORDER BY rowid",[t,l],'document_by_shipment'],
   ["SELECT data FROM resources WHERE kind='pod' AND tenant_id=? AND json_extract(data,'$.loadId')=? AND json_extract(data,'$.recipientAcknowledged')=1 ORDER BY rowid",[t,l],'pod_by_shipment'],
   ["SELECT data FROM resources WHERE kind='documentexception' AND tenant_id=? AND json_extract(data,'$.loadId')=? AND json_extract(data,'$.status')='open' ORDER BY rowid LIMIT 1",[t,l],'open_document_exception_by_shipment']
  ];
  for(const [sql,args,index] of plans){
   const plan=store.db.prepare('EXPLAIN QUERY PLAN '+sql).all(...args).map(r=>r.detail).join(' ');
   assert.ok(plan.includes(index),plan);
  }
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
