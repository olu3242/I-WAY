import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OperationsStore} from '../server/operations-store.mjs';

test('shipment-scoped POD, exception and duplicate lookup matches original tenant-filtered behavior',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-document-related-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const tenant=randomUUID(),foreign=randomUUID(),loadId=randomUUID(),otherLoad=randomUUID(),stopId=randomUUID();
  for(const id of [tenant,foreign])store.db.prepare('INSERT INTO tenants(id,name,timezone) VALUES(?,?,?)').run(id,'Fixture','UTC');
  const pod=(t,l,ack,stop)=>store.insert('pod',t,{loadId:l,recipientAcknowledged:ack,stopId:stop});
  pod(tenant,otherLoad,true,stopId);pod(foreign,loadId,true,stopId);pod(tenant,loadId,false,stopId);
  const valid=pod(tenant,loadId,true,stopId);
  const expected=store.list('pod',tenant).filter(p=>p.loadId===loadId&&p.recipientAcknowledged===true);
  const sql="SELECT data FROM resources WHERE kind='pod' AND tenant_id=? AND json_extract(data,'$.loadId')=? AND json_extract(data,'$.recipientAcknowledged')=1 ORDER BY rowid";
  const actual=store.db.prepare(sql).all(tenant,loadId).map(r=>JSON.parse(r.data));
  assert.deepEqual(actual.map(p=>p.id),expected.map(p=>p.id));
  assert.deepEqual(actual.map(p=>p.id),[valid.id]);
  const duplicate=store.db.prepare("SELECT 1 FROM resources WHERE kind='pod' AND tenant_id=? AND json_extract(data,'$.loadId')=? AND json_extract(data,'$.stopId')=? LIMIT 1");
  assert.ok(duplicate.get(tenant,loadId,stopId));assert.equal(duplicate.get(tenant,otherLoad,'absent'),undefined);
  const exception=(t,l,status)=>store.insert('documentexception',t,{loadId:l,status});
  exception(tenant,otherLoad,'open');exception(foreign,loadId,'open');exception(tenant,loadId,'resolved');
  const active=exception(tenant,loadId,'open');
  const current=store.db.prepare("SELECT data FROM resources WHERE kind='documentexception' AND tenant_id=? AND json_extract(data,'$.loadId')=? AND json_extract(data,'$.status')='open' ORDER BY rowid LIMIT 1").get(tenant,loadId);
  assert.equal(JSON.parse(current.data).id,active.id);
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
