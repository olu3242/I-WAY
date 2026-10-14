import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OperationsStore} from '../server/operations-store.mjs';

test('indexed availability lookup preserves tenant scope, active status and excluded load semantics',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-eligibility-index-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const t1=randomUUID(),t2=randomUUID(),driver=randomUUID(),vehicle=randomUUID();
  store.db.prepare('INSERT INTO tenants(id,name,timezone) VALUES(?,?,?)').run(t1,'First','UTC');
  store.db.prepare('INSERT INTO tenants(id,name,timezone) VALUES(?,?,?)').run(t2,'Second','UTC');
  const insert=(tenantId,status,loadId)=>store.insert('assignment',tenantId,{driverId:driver,vehicleId:vehicle,status,loadId});
  insert(t2,'active','foreign');
  insert(t1,'ended','old');
  const query=kind=>`SELECT 1 FROM resources WHERE kind='assignment' AND tenant_id=? AND json_extract(data,'$.status')='active' AND json_extract(data,'$.loadId') IS NOT ? AND json_extract(data,'$.${kind}Id')=? LIMIT 1`;
  for(const kind of ['driver','vehicle']){
   const resourceId=kind==='driver'?driver:vehicle;
   assert.equal(store.db.prepare(query(kind)).get(t1,null,resourceId),undefined);
  }
  insert(t1,'active','current');
  for(const kind of ['driver','vehicle']){
   const resourceId=kind==='driver'?driver:vehicle;
   assert.ok(store.db.prepare(query(kind)).get(t1,null,resourceId));
   assert.equal(store.db.prepare(query(kind)).get(t1,'current',resourceId),undefined);
  }
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
test('active assignment partial indexes remain available',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iway-index-plan-'));
 const store=new OperationsStore(join(root,'db.sqlite'));
 try{
  const indexes=store.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(x=>x.name);
  for(const name of ['active_load_assignment','active_driver_assignment','active_vehicle_assignment'])assert.ok(indexes.includes(name));
 }finally{store.close();await rm(root,{recursive:true,force:true})}
});
