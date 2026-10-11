import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixture} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {authorize} from '../domain/authorization.mjs';

test('real local load journey persists across a new database connection',async t=>{
 const f=await fixture(t);let load=f.assign();
 for(const [action,payload] of [['load:accept',{}],['load:pickup',{stopId:'stop-0'}],['load:transit',{}],['load:deliver',{stopId:'stop-1',proofReference:'illustrative-pod-reference'}]])load=f.command(f.driver,action,load,payload);
 assert.equal(load.status,'delivered');assert.ok(load.deliveredAt.endsWith('Z'));
 const reopened=new OperationsStore(f.path);
 const state=new Operations(reopened).state(f.manager.id);
 assert.equal(state.loads[0].status,'delivered');assert.equal(state.shipments[0].status,'delivered');
 assert.equal(state.assignments[0].status,'ended');assert.ok(state.audit.some(a=>a.action==='load:deliver'));reopened.close();
});

test('authorization requires role, permission, tenant and assigned relationship',async t=>{
 const f=await fixture(t);const load=f.createLoad();
 for(const actor of [f.outsider,f.driver,f.fleetUser,f.otherDispatcher])assert.throws(()=>f.command(actor,'load:validate',load),e=>[403,404].includes(e.status));
 const without={...f.manager,permissions:[]};
 assert.equal(authorize({actor:without,action:'load:dispatch',resource:load}),false);
 assert.equal(authorize({actor:{...f.manager,role:'platform'},action:'load:dispatch',resource:load}),false);
 assert.equal(authorize({actor:f.manager,action:'madeup:action',resource:load}),false);
 assert.deepEqual(f.ops.state(f.outsider.id).loads,[]);
});

test('driver and fleet views hide carrier commercial fields and other fleet assets',async t=>{
 const f=await fixture(t);f.assign();
 const driver=f.ops.state(f.driver.id);
 assert.equal(driver.loads.length,1);assert.equal(driver.loads[0].rateCents,undefined);assert.equal(driver.loads[0].customer,undefined);
 assert.equal(f.ops.state(f.fleetUser.id).loads.length,0);assert.equal(f.ops.state(f.fleetUser.id).vehicles.length,0);
 assert.throws(()=>f.command(f.fleetUser,'driver:approve',f.store.get('driver',f.driver.id,f.manager.tenantId),{approved:true,reason:'attempt'}),/permitted/);
});

test('eligibility rejects expired, critical, unapproved and busy resources',async t=>{
 const f=await fixture(t);let load=f.createLoad();load=f.command(f.dispatcher,'load:validate',load);
 let driver=f.store.get('driver',f.driver.id,f.manager.tenantId);
 driver=f.command(f.manager,'driver:update',driver,{compliance:'critical',reason:'Illustrative critical compliance'});
 assert.throws(()=>f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'test'}),e=>e.code==='INELIGIBLE');
 f.command(f.manager,'driver:update',driver,{compliance:'valid',reason:'Resolved after review'});
 f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'test'});
 let second=f.createLoad();second=f.command(f.dispatcher,'load:validate',second);
 assert.throws(()=>f.command(f.dispatcher,'load:assign',second,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'test'}),e=>e.code==='INELIGIBLE');
 assert.equal(f.store.list('assignment',f.manager.tenantId).filter(a=>a.status==='active').length,1);
});

test('duplicate commands are replay-safe and stale or invalid transitions fail',async t=>{
 const f=await fixture(t),load=f.createLoad(),idempotencyKey=randomUUID();
 const c={action:'load:validate',resourceId:load.id,expectedVersion:load.version,payload:{},idempotencyKey};
 const first=f.ops.execute(f.dispatcher.id,c),second=f.ops.execute(f.dispatcher.id,c);
 assert.deepEqual(second,first);
 assert.throws(()=>f.ops.execute(f.dispatcher.id,{...c,action:'load:void',payload:{reason:'Different request'}}),e=>e.code==='IDEMPOTENCY');
 assert.throws(()=>f.command(f.dispatcher,'load:validate',load),e=>e.code==='STALE');
 const assigned=f.command(f.dispatcher,'load:assign',first,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'test'});
 assert.throws(()=>f.command(f.driver,'load:deliver',assigned,{stopId:'stop-1',proofReference:'test'}),e=>e.code==='TRANSITION');
 assert.ok(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE outcome='denied'").get().n>=3);
 assert.throws(()=>f.store.db.exec("DELETE FROM audit"),/append only/);
});

function worker(path,actor,command){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('./helpers/operations-worker.mjs',import.meta.url)),path,actor,JSON.stringify(command)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',s=>output+=s);child.on('error',reject);child.on('exit',()=>{try{resolve(JSON.parse(output))}catch{reject(new Error('Worker result unavailable'))}});
 });
}
test('independent processes serialize competing assignments without double booking',async t=>{
 const f=await fixture(t);
 let one=f.createLoad(),two=f.createLoad();one=f.command(f.dispatcher,'load:validate',one);two=f.command(f.dispatcher,'load:validate',two);
 const commands=[one,two].map(load=>({action:'load:assign',resourceId:load.id,expectedVersion:load.version,idempotencyKey:randomUUID(),payload:{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Illustrative concurrent dispatch'}}));
 const results=await Promise.all(commands.map(c=>worker(f.path,f.dispatcher.id,c)));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>!r.ok&&r.code==='INELIGIBLE').length,1);
 assert.equal(f.store.list('assignment',f.manager.tenantId).filter(a=>a.status==='active').length,1);
});

test('master records deactivate and vehicle ownership cannot be silently overwritten',async t=>{
 const f=await fixture(t);
 assert.throws(()=>f.command(f.manager,'vehicle:update',f.vehicle,{ownerId:'other',reason:'attempt'}),e=>e.code==='FIELDS');
 const inactive=f.command(f.manager,'vehicle:update',f.vehicle,{active:false,reason:'Illustrative retirement'});
 assert.equal(inactive.active,false);assert.equal(f.store.list('vehicle',f.manager.tenantId).length,1);
});

test('fleet administrators own employment and cannot manage another fleet or carrier employee',async t=>{
 const f=await fixture(t),payload={name:'Illustrative fleet employee',username:'employee@illustrative.invalid',password:'illustrative-fixture-only-47'};
 const driver=f.command(f.fleetUser,'driver:create',null,payload);
 assert.equal(driver.fleetId,f.fleet.id);assert.equal(f.store.get('driver',driver.id,f.manager.tenantId).approved,false);
 assert.throws(()=>f.command(f.manager,'user:create',null,{...payload,role:'driver',fleetId:f.fleet.id}),e=>e.code==='EMPLOYMENT');
 assert.throws(()=>f.command(f.fleetUser,'user:deactivate',f.driver,{reason:'Not employed here'}),e=>e.code==='EMPLOYMENT');
 assert.throws(()=>f.command(f.fleetUser,'driver:create',null,{...payload,tenantId:f.outsider.tenantId}),e=>e.code==='FIELDS');
 const result=f.command(f.fleetUser,'user:deactivate',driver,{reason:'Illustrative employment ended'});
 assert.equal(result.active,false);assert.equal(f.ops.state(f.fleetUser.id).users.length,1);
 assert.equal(f.ops.state(f.outsider.id).users.length,1);
});
test('each compliance, capacity, maintenance and ownership failure independently blocks dispatch',async t=>{
 const f=await fixture(t);let load=f.createLoad();load=f.command(f.dispatcher,'load:validate',load);
 const attempt=()=>f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Eligibility check'});
 const get=kind=>f.store.get(kind,kind==='driver'?f.driver.id:f.vehicle.id,f.manager.tenantId);
 for(const [kind,change,restore] of [
  ['driver',{expiresOn:'2000-01-01'},{expiresOn:'2099-12-31'}],
  ['driver',{available:false},{available:true}],
  ['driver',{active:false},{active:true}],
  ['vehicle',{maintenance:'due'},{maintenance:'ready'}],
  ['vehicle',{available:false},{available:true}]
 ]){
  f.command(f.manager,kind+':update',get(kind),{...change,reason:'Illustrative failing eligibility'});
  assert.throws(attempt,e=>e.code==='INELIGIBLE');
  f.command(f.manager,kind+':update',get(kind),{...restore,reason:'Illustrative resolution'});
 }
 f.command(f.manager,'driver:approve',get('driver'),{approved:false,reason:'Review pending'});
 assert.throws(attempt,e=>e.code==='INELIGIBLE');
 f.command(f.manager,'driver:approve',get('driver'),{approved:true,reason:'Review completed'});
 f.command(f.manager,'vehicle:approve',get('vehicle'),{approved:false,reason:'Review pending'});
 assert.throws(attempt,e=>e.code==='INELIGIBLE');
 const small=f.command(f.manager,'vehicle:create',null,{name:'Illustrative small truck',capacityLb:10});
 f.command(f.manager,'vehicle:approve',small,{approved:true,reason:'Illustrative approved vehicle'});
 assert.throws(()=>f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:small.id,reason:'Too small'}),e=>e.code==='INELIGIBLE');
 const fleetVehicle=f.command(f.fleetUser,'vehicle:create',null,{name:'Other owner',capacityLb:45000});
 f.command(f.manager,'vehicle:approve',fleetVehicle,{approved:true,reason:'Illustrative approval'});
 assert.throws(()=>f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:fleetVehicle.id,reason:'Different owner'}),e=>e.code==='INELIGIBLE');
});
