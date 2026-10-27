import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
const reason='Illustrative correction';
const fourStep=f=>({reference:'ILL FOUR',customer:'Illustrative broker',dispatcherId:f.dispatcher.id,commodity:'Illustrative cargo',weightLb:1000,rateCents:10000,charges:[],factored:false,billTo:'Illustrative broker',paymentTerms:'Illustrative Net 30',stops:[{type:'pickup',location:'Illustrative A',at:'2026-11-02T10:00:00Z'},{type:'delivery',location:'Illustrative B',at:'2026-11-03T10:00:00Z'}]});
test('four-step stage validation rejects cargo, money, billing and chronology without creating loads',async t=>{
 const f=await fixture(t,createOperationsFeatures()),data=fourStep(f);
 for(const [stage,patch] of [[0,{commodity:' '}],[0,{weightLb:0}],[0,{dispatcherId:f.outsider.id}],[1,{stops:[data.stops[1],data.stops[0]]}],[2,{rateCents:-1}],[2,{rateCents:1.5}],[2,{rateCents:100000001}],[2,{charges:[{label:'Illustrative',amountCents:-1}]}],[2,{factored:true,factorName:''}],[2,{paymentTerms:' '}],[2,{billTo:''}]]){
  assert.throws(()=>f.command(f.manager,'loaddraft:save',null,{data:{...data,...patch},stage,flowVersion:2,advance:true}));
 }
 assert.equal(f.store.list('loaddraft',f.manager.tenantId).length,0);assert.equal(f.store.list('load',f.manager.tenantId).length,0);assert.equal(f.store.list('shipment',f.manager.tenantId).length,0);
});
test('four-step drafts cannot bypass final validation, tenant membership or carrier authority',async t=>{
 const f=await fixture(t,createOperationsFeatures()),data=fourStep(f);let draft=f.command(f.manager,'loaddraft:save',null,{data:{...data,paymentTerms:''},stage:3,flowVersion:2});
 assert.throws(()=>f.command(f.manager,'loaddraft:submit',draft,{}));
 for(const actor of [f.driver,f.fleetUser,f.dispatcher,f.outsider]){assert.throws(()=>f.command(actor,'loaddraft:save',draft,{data,stage:3,flowVersion:2,advance:true}));assert.throws(()=>f.command(actor,'loaddraft:submit',draft,{}));assert.equal(f.ops.state(actor.id).loaddrafts.length,0);}
 draft=f.command(f.manager,'loaddraft:save',draft,{data,stage:3,flowVersion:2,advance:true});const key='illustrative-four-step-receipt',load=f.command(f.manager,'loaddraft:submit',draft,{},key);
 assert.equal(f.command(f.manager,'loaddraft:submit',draft,{},key).id,load.id);assert.throws(()=>f.command(f.manager,'loaddraft:submit',draft,{}));assert.equal(f.store.list('load',f.manager.tenantId).length,1);assert.equal(f.store.list('shipment',f.manager.tenantId).length,1);assert.equal(f.ops.state(f.outsider.id).loads.length,0);
});
test('four-step submission rolls back the load when the existing shipment contract fails',async t=>{
 const f=await fixture(t,createOperationsFeatures()),data=fourStep(f),draft=f.command(f.manager,'loaddraft:save',null,{data,stage:3,flowVersion:2,advance:true});
 f.store.db.exec("CREATE TRIGGER illustrative_shipment_fault BEFORE INSERT ON resources WHEN NEW.kind='shipment' BEGIN SELECT RAISE(ABORT,'Illustrative transaction fault'); END");
 assert.throws(()=>f.command(f.manager,'loaddraft:submit',draft,{}));assert.equal(f.store.list('load',f.manager.tenantId).length,0);assert.equal(f.store.get('loaddraft',draft.id,f.manager.tenantId).status,'draft');
 f.store.db.exec('DROP TRIGGER illustrative_shipment_fault');assert.ok(f.command(f.manager,'loaddraft:submit',draft,{}).id);assert.equal(f.store.list('shipment',f.manager.tenantId).length,1);
});
test('load drafts persist partial stages and submit one validated multi-stop commercial contract',async t=>{
 const f=await fixture(t,createOperationsFeatures());let draft=f.command(f.manager,'loaddraft:save',null,{stage:0,data:{reference:'ILL-WIZARD'}});
 assert.equal(f.ops.state(f.manager.id).loaddrafts[0].id,draft.id);assert.throws(()=>f.command(f.manager,'loaddraft:submit',draft,{}));
 const base=f.createLoad();const {id,kind,tenantId,version,status,driverId,vehicleId,fleetId,createdAt,lifecycleState,...data}=base;void id;void kind;void tenantId;void version;void status;void driverId;void vehicleId;void fleetId;void createdAt;void lifecycleState;
 data.stops=data.stops.map(({id,completedAt,...s})=>s);data.stops.splice(1,0,{type:'pickup',location:'Illustrative second pickup',at:'2026-11-02T15:00:00Z',windowEnd:'2026-11-02T16:00:00Z',privateNotes:'Carrier-only instruction'});data.privateNotes='Carrier-only terms';
 draft=f.command(f.manager,'loaddraft:save',draft,{stage:4,data:{...data,customerId:''}});const load=f.command(f.manager,'loaddraft:submit',draft,{} ,'illustrative-wizard-key');
 assert.equal(load.stops.length,3);assert.equal(load.status,'draft');assert.equal(f.store.list('shipment',f.manager.tenantId).find(s=>s.loadId===load.id).stops.length,3);
 assert.equal(f.command(f.manager,'loaddraft:submit',draft,{},'illustrative-wizard-key').id,load.id);assert.throws(()=>f.command(f.manager,'loaddraft:submit',draft,{}));assert.equal(f.ops.state(f.manager.id).loaddrafts.length,0);
});
test('draft and correction permissions, stale versions, windows and protected execution are enforced',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.createLoad();const data={reference:load.reference,customer:load.customer,dispatcherId:f.dispatcher.id,commodity:load.commodity,weightLb:1000,rateCents:10,stops:load.stops.map(({id,completedAt,...s})=>s),charges:[]};
 for(const actor of [f.driver,f.fleetUser,f.dispatcher])assert.throws(()=>f.command(actor,'loaddraft:save',null,{data:{reference:'Denied'},stage:0}),e=>e.status===403);
 let updated=f.command(f.manager,'load:edit',load,{data:{...data,privateNotes:'Carrier-only'},reason});assert.equal(updated.rateCents,10);assert.throws(()=>f.command(f.manager,'load:edit',load,{data,reason}),e=>e.code==='STALE');
 assert.throws(()=>f.command(f.manager,'load:edit',updated,{data:{...data,stops:[{...data.stops[0],windowEnd:'2020-01-01T00:00:00Z'},data.stops[1]]},reason}),e=>e.code==='STOP_WINDOW');
 updated=f.command(f.dispatcher,'load:validate',updated);updated=f.command(f.dispatcher,'load:assign',updated,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason});assert.throws(()=>f.command(f.manager,'load:edit',updated,{data,reason}),e=>e.code==='TRANSITION');
 assert.equal(f.ops.state(f.driver.id).loads[0].privateNotes,undefined);assert.throws(()=>f.command(f.outsider,'load:edit',updated,{data,reason}));
});
