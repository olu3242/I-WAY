import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OperationsStore} from '../server/operations-store.mjs';

test('shipment-scoped document lookup preserves revision order and tenant isolation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-document-query-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const tenant=randomUUID(),foreign=randomUUID(),loadId=randomUUID(),otherLoad=randomUUID();
  for(const id of [tenant,foreign])store.db.prepare('INSERT INTO tenants(id,name,timezone) VALUES(?,?,?)').run(id,'Fixture','UTC');
  const insert=(t,l,previousDocId=null)=>store.insert('document',t,{loadId:l,type:'BOL',previousDocId,status:'pending_review'});
  const first=insert(tenant,loadId);insert(tenant,otherLoad);const second=insert(tenant,loadId,first.id);insert(foreign,loadId);
  const old=store.list('document',tenant).filter(d=>d.loadId===loadId);
  const actual=store.db.prepare("SELECT data FROM resources WHERE kind='document' AND tenant_id=? AND json_extract(data,'$.loadId')=? ORDER BY rowid").all(tenant,loadId).map(r=>JSON.parse(r.data));
  assert.deepEqual(actual.map(x=>x.id),old.map(x=>x.id));
  assert.deepEqual(actual.map(x=>x.id),[first.id,second.id]);
  const previous=new Set(actual.map(d=>d.previousDocId).filter(Boolean));
  assert.deepEqual(actual.filter(d=>!previous.has(d.id)).map(d=>d.id),[second.id]);
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
