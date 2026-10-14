import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize} from '../domain/authorization.mjs';
const resource={tenantId:'carrier-a',fleetId:'fleet-1',driverId:'driver-1'};
test('carrier may dispatch own tenant with permission',()=>assert.equal(authorize({actor:{id:'a',tenantId:'carrier-a',role:'carrier',permissions:['load:dispatch']},action:'load:dispatch',resource}),true));
test('cross-tenant request denied',()=>assert.equal(authorize({actor:{id:'a',tenantId:'carrier-b',role:'carrier',permissions:['load:dispatch']},action:'load:dispatch',resource}),false));
test('fleet cannot approve carrier driver',()=>assert.equal(authorize({actor:{id:'f',tenantId:'carrier-a',role:'fleet',fleetId:'fleet-1',permissions:['driver:approve']},action:'driver:approve',resource}),false));
test('driver cannot dispatch load',()=>assert.equal(authorize({actor:{id:'driver-1',tenantId:'carrier-a',role:'driver',permissions:['load:dispatch']},action:'load:dispatch',resource}),false));
test('driver can execute only own load',()=>{const actor={id:'driver-1',tenantId:'carrier-a',role:'driver',permissions:['load:execute']};assert.equal(authorize({actor,action:'load:execute',resource}),true);assert.equal(authorize({actor,action:'load:execute',resource:{...resource,driverId:'other'}}),false)});
