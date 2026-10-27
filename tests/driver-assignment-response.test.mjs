import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
test('driver rejection releases only the current assignment with audited reason and replay-safe receipt',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign(),key='ILL-REJECT-REPLAY',payload={reason:'Illustrative unavailable for this assignment'};
 assert.throws(()=>f.command(f.outsider,'load:reject',load,payload));
 assert.throws(()=>f.command(f.manager,'load:reject',load,payload));
 assert.throws(()=>f.command(f.driver,'load:reject',load,{reason:''}));
 const result=f.command(f.driver,'load:reject',load,payload,key);assert.equal(result.status,'rejected');assert.deepEqual(f.command(f.driver,'load:reject',load,payload,key),result);
 assert.equal(f.store.get('load',load.id,load.tenantId).driverId,null);assert.equal(f.store.get('load',load.id,load.tenantId).status,'validated');assert.equal(f.ops.state(f.driver.id).loads.length,0);
 assert.equal(f.store.list('assignment',load.tenantId).filter(a=>a.status==='active').length,0);assert.equal(f.store.list('assignmentresponse',load.tenantId).length,1);
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM audit WHERE action='load:reject' AND outcome='success'").get().n,1);
 const next=f.assign();f.command(f.driver,'load:accept',next);assert.throws(()=>f.command(f.driver,'load:reject',f.store.get('load',next.id,next.tenantId),payload));
});
