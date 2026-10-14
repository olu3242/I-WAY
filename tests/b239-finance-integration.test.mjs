import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';

// B239: reuse the existing Operations finance handlers and audit store.
// No parallel invoice service, database schema, or payment engine.
test('B239: invoice cannot be prepared before delivery',async t=>{
 const f=await fixture(t);
 const load=f.assign();
 assert.throws(()=>f.command(f.manager,'finance:prepare',load),error=>error.code==='INVOICE_STATE');
 assert.equal(f.store.list('invoice',f.manager.tenantId).length,0);
});

test('B239: unauthorized actors cannot prepare or approve financial records',async t=>{
 const f=await fixture(t);
 let load=f.assign();
 load=f.command(f.driver,'load:accept',load);
 load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});
 load=f.command(f.driver,'load:transit',load);
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'illustrative-proof'});
 for(const actor of [f.driver,f.fleetUser,f.outsider]){
  assert.throws(()=>f.command(actor,'finance:prepare',load));
 }
 const invoice=f.command(f.manager,'finance:prepare',load);
 assert.equal(invoice.status,'ready');
 for(const actor of [f.driver,f.fleetUser,f.outsider]){
  assert.throws(()=>f.command(actor,'finance:approve',invoice,{reason:'Unauthorized attempt'}));
 }
 assert.equal(f.store.get('invoice',invoice.id,f.manager.tenantId).status,'ready');
});

test('B239: financial approval is single-use and cannot be replayed with a new command',async t=>{
 const f=await fixture(t);
 let load=f.assign();
 load=f.command(f.driver,'load:accept',load);
 load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});
 load=f.command(f.driver,'load:transit',load);
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'illustrative-proof'});
 const invoice=f.command(f.manager,'finance:prepare',load);
 const approved=f.command(f.manager,'finance:approve',invoice,{reason:'Verified invoice'});
 assert.equal(approved.status,'approved');
 assert.throws(()=>f.command(f.manager,'finance:approve',approved,{reason:'Second approval'}),error=>error.code==='INVOICE_STATE');
 assert.equal(f.store.list('invoice',f.manager.tenantId).length,1);
});
