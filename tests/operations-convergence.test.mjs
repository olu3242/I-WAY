import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';import {addUser} from '../server/operations-auth.mjs';import {portalState} from '../domain/operations-portal.mjs';
test('command responses and idempotent replays hide carrier commercial fields from drivers',async t=>{
 const f=await fixture(t),load=f.assign(),command={action:'load:accept',resourceId:load.id,expectedVersion:load.version,payload:{},idempotencyKey:randomUUID()};
 for(const response of [f.ops.execute(f.driver.id,command),f.ops.execute(f.driver.id,command)])for(const key of ['rateCents','charges','customer','customerId','factorName','factored'])assert.equal(response[key],undefined,key);
 const next=f.store.get('load',load.id,f.manager.tenantId);f.command(f.dispatcher,'load:assign',next,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'New assignment'});
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).rateCents,250000);
});
test('carrier role does not bypass permission checks for users, fleets or invoices',async t=>{
 const f=await fixture(t);const limited=addUser(f.store,{tenantId:f.manager.tenantId,username:'limited@illustrative.invalid',name:'Limited carrier',role:'carrier',permissions:['load:view'],password});
 const state=f.ops.state(limited.id);assert.deepEqual(state.users,[]);assert.deepEqual(state.fleets,[]);assert.deepEqual(state.audit,[]);assert.deepEqual(state.invoices,[]);
});
test('customer portal uses persisted identity relationship, never company text or client tenant claims',async t=>{
 const f=await fixture(t);f.ops.views=[portalState];
 const customer=f.command(f.manager,'customer:create',null,{name:'Illustrative customer'});
 const second=f.command(f.manager,'customer:create',null,{name:'Illustrative customer'});
 const account=addUser(f.store,{tenantId:f.manager.tenantId,username:'customer@illustrative.invalid',name:'Illustrative shipper',role:'customer',customerId:customer.id,password});
 let one=f.createLoad(),two=f.createLoad();
 // Fixture links represent server-validated load:create customerId; names intentionally match.
 one=f.store.update('load',one.id,f.manager.tenantId,one.version,{customerId:customer.id});
 f.store.update('load',two.id,f.manager.tenantId,two.version,{customerId:second.id});
 const state=f.ops.state(account.id);assert.equal(state.loads.length,1);assert.equal(state.loads[0].id,one.id);
 for(const key of ['rateCents','charges','dispatcherId','driverId','customerId'])assert.equal(state.loads[0][key],undefined);
 for(const key of ['users','drivers','vehicles','assignments','exceptions','customers'])assert.deepEqual(state[key],[]);
 assert.throws(()=>f.command(account,'load:validate',one),e=>e.code==='FORBIDDEN');
 assert.throws(()=>f.command(f.manager,'user:create',null,{username:'invalid@illustrative.invalid',name:'Invalid',role:'customer',customerId:f.outsider.tenantId,password}),e=>e.code==='NOT_FOUND');
});
