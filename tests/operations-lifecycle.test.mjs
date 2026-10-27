import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {readDocument,shippingDocumentReadiness} from '../domain/operations-documents.mjs';
import {runNotificationTick} from '../domain/operations-business.mjs';
const setup=t=>fixture(t,createOperationsFeatures());
const current=(f,kind,id)=>f.store.get(kind,id,f.manager.tenantId);
function bol(f,load){
 const content=JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location});
 const doc=f.command(f.manager,'document:ingest',load,{type:'BOL',mimeType:'application/json',content});
 return f.command(f.manager,'document:review',doc,{decision:'validate',reason:'Reviewed synthetic source'});
}
function transit(f,load){load=f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Synthetic dispatch'});load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});return f.command(f.driver,'load:transit',load);}
function resolve(f,exception){
 let w=f.store.list('workflow',f.manager.tenantId).find(w=>w.exceptionId===exception.id);
 w=f.command(f.dispatcher,'workflow:advance',w);let a=current(f,'approval',w.approvalId);
 f.command(f.manager,'approval:decide',a,{decision:'approved',reason:'Human reviews synthetic resolution'});
 return f.command(f.dispatcher,'workflow:advance',current(f,'workflow',w.id));
}
test('canonical lifecycle persists Ready and Closed with atomic shipment mirror and mandatory BOL/POD',async t=>{
 const f=await setup(t);let load=f.createLoad();assert.equal(load.lifecycleState,'draft');
 assert.throws(()=>f.command(f.dispatcher,'load:ready',load),{code:'TRANSITION'});
 load=f.command(f.dispatcher,'load:validate',load);assert.equal(load.lifecycleState,'validated');
 assert.throws(()=>f.command(f.outsider,'load:ready',load),{code:'NOT_FOUND'});
 load=f.command(f.dispatcher,'load:ready',load);assert.equal(load.lifecycleState,'ready');
 let a=f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Synthetic dispatch'});assert.equal(a.lifecycleState,'assigned');
 a=f.command(f.driver,'load:accept',a);assert.equal(a.lifecycleState,'dispatched');
 a=f.command(f.driver,'load:pickup',a,{stopId:a.stops[0].id});a=f.command(f.driver,'load:transit',a);assert.equal(a.lifecycleState,'in_transit');
 a=f.command(f.driver,'load:deliver',a,{stopId:a.stops.at(-1).id,proofReference:'ILL-POD'});assert.equal(a.lifecycleState,'delivered');
 assert.throws(()=>f.command(f.dispatcher,'load:close',a,{reason:'Missing evidence'}),{code:'CLOSURE_DOCUMENTS'});
 bol(f,a);assert.throws(()=>f.command(f.dispatcher,'load:close',a,{reason:'Missing POD'}),{code:'CLOSURE_DOCUMENTS'});
 f.command(f.driver,'pod:record',a,{stopId:a.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-POD'});
 const c={action:'load:close',resourceId:a.id,expectedVersion:a.version,payload:{reason:'Human validates closure'},idempotencyKey:randomUUID()};
 const closed=f.ops.execute(f.dispatcher.id,c);assert.equal(closed.lifecycleState,'closed');assert.deepEqual(f.ops.execute(f.dispatcher.id,c),closed);
 assert.equal(f.store.list('shipment',f.manager.tenantId).find(s=>s.loadId===closed.id).closedAt,closed.closedAt);
 assert.throws(()=>f.command(f.dispatcher,'load:close',closed,{reason:'Again'}),{code:'TRANSITION'});
 assert.equal(f.store.list('assignment',f.manager.tenantId).filter(a=>a.status==='active').length,0);
});
test('assignment cancellation releases assets, retries are idempotent and reassignment remains authorized',async t=>{
 const f=await setup(t);let load=f.assign();
 assert.throws(()=>f.command(f.driver,'load:unassign',load,{reason:'Denied'}),{code:'FORBIDDEN'});
 const c={action:'load:unassign',resourceId:load.id,expectedVersion:load.version,payload:{reason:'Synthetic carrier cancellation'},idempotencyKey:randomUUID()};
 load=f.ops.execute(f.dispatcher.id,c);assert.deepEqual(f.ops.execute(f.dispatcher.id,c),load);assert.equal(load.driverId,null);
 const e=f.command(f.dispatcher,'exception:report',load,{type:'failed_dispatch',reason:'Assignment cancelled'});assert.equal(resolve(f,e).status,'completed');
 load=transit(f,load);assert.throws(()=>f.command(f.dispatcher,'load:unassign',load,{reason:'Too late'}),{code:'TRANSITION'});
 assert.equal(f.store.list('assignment',f.manager.tenantId).filter(a=>a.status==='active').length,1);
});
test('tracking records event time, deduplicates identifiers and retains out-of-order evidence without status regression',async t=>{
 const f=await setup(t);const load=transit(f,f.command(f.dispatcher,'load:validate',f.createLoad()));
 const p={location:'Illustrative location',note:'Synthetic milestone',occurredAt:'2026-01-02T12:00:00.000Z',externalId:'ILL-2'};
 const latest=f.command(f.driver,'tracking:record',load,p);assert.equal(latest.provenance,'human_reported');assert.deepEqual(f.command(f.driver,'tracking:record',load,p),latest);
 assert.throws(()=>f.command(f.driver,'tracking:record',load,{...p,note:'Changed'}),{code:'TRACKING_CONFLICT'});
 const older=f.command(f.driver,'tracking:record',load,{...p,externalId:'ILL-1',occurredAt:'2026-01-01T12:00:00.000Z'});assert.equal(older.outOfOrder,true);
 assert.throws(()=>f.command(f.driver,'tracking:record',load,{...p,externalId:'future',occurredAt:'2099-01-01T00:00:00.000Z'}),{code:'TRACKING_DATE'});
 assert.equal(current(f,'load',load.id).status,'in_transit');assert.equal(f.store.list('tracking',f.manager.tenantId).length,2);
});
test('all operational exception categories use durable human review and block progress until resolution',async t=>{
 const f=await setup(t);const load=transit(f,f.command(f.dispatcher,'load:validate',f.createLoad()));
 for(const type of ['delayed_pickup','delayed_delivery','carrier_cancellation','tracking_interruption','missing_documentation','failed_dispatch','delivery_discrepancy','integration_outage']){
  const e=f.command(f.dispatcher,'exception:report',load,{type,reason:'Synthetic failure injection'});
  assert.throws(()=>f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-POD'}),{code:'EXCEPTION'});
  assert.equal(resolve(f,e).status,'completed');assert.equal(current(f,'exception',e.id).status,'resolved');
 }
 assert.equal(f.store.list('shipment',f.manager.tenantId).length,1);assert.equal(f.store.list('assignment',f.manager.tenantId).length,1);
});
test('document corruption fails retrieval and closure readiness even if storage triggers are bypassed by fixture administrator',async t=>{
 const f=await setup(t),load=f.assign(),doc=bol(f,load);
 f.store.db.exec('DROP TRIGGER document_content_immutable');
 f.store.db.prepare("UPDATE resources SET data=json_set(data,'$.content','synthetic corruption') WHERE id=?").run(doc.id);
 assert.throws(()=>readDocument(f.ops,f.manager,doc.id),{code:'DOCUMENT_INTEGRITY'});
 assert.ok(shippingDocumentReadiness(f.ops,f.manager,load).issues.includes('BOL_INTEGRITY'));
});
test('opted-in lifecycle notifications are local-only, authorized, versioned and duplicate-safe',async t=>{
 const f=await setup(t),templates=['shipment_created','dispatch_confirmed','pickup_completed','in_transit','operational_exception','load_delivered','pod_available'];
 f.command(f.manager,'notification:preferences',null,{enabled:true,templates});
 let load=transit(f,f.command(f.dispatcher,'load:validate',f.createLoad()));
 const e=f.command(f.dispatcher,'exception:report',load,{type:'tracking_interruption',reason:'Synthetic outage'});resolve(f,e);
 bol(f,load);f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-POD'});
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-POD'});
 runNotificationTick(f.ops);const own=f.store.list('notification',f.manager.tenantId).filter(n=>n.recipientId===f.manager.id);
 assert.deepEqual(own.map(n=>n.template).sort(),templates.sort());assert.ok(own.every(n=>n.status==='local_recorded'&&n.externalDelivery===false&&n.templateVersion===1));
 const count=f.store.list('notification',f.manager.tenantId).length;runNotificationTick(f.ops);assert.equal(f.store.list('notification',f.manager.tenantId).length,count);
 assert.equal(f.store.list('notification',f.outsider.tenantId).length,0);
});

test('shipment mirror failure rolls back the new milestone, audit and command receipt atomically',async t=>{
 const f=await setup(t),load=f.command(f.dispatcher,'load:validate',f.createLoad());
 const before=f.store.db.prepare('SELECT (SELECT count(*) FROM audit) AS audit,(SELECT count(*) FROM commands) AS commands').get();
 f.store.db.exec("CREATE TRIGGER fixture_shipment_failure BEFORE UPDATE ON resources WHEN OLD.kind='shipment' BEGIN SELECT RAISE(ABORT,'fixture mirror failure'); END;");
 try{assert.throws(()=>f.command(f.dispatcher,'load:ready',load),{code:'STORAGE'});assert.equal(current(f,'load',load.id).readyAt,undefined);assert.equal(current(f,'load',load.id).version,load.version);
 const after=f.store.db.prepare('SELECT (SELECT count(*) FROM audit WHERE outcome=?) AS audit,(SELECT count(*) FROM commands) AS commands').get('success');assert.equal(after.audit,before.audit);assert.equal(after.commands,before.commands);
 }finally{f.store.db.exec('DROP TRIGGER fixture_shipment_failure')}
 assert.equal(f.command(f.dispatcher,'load:ready',load).lifecycleState,'ready');
});
