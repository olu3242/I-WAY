import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {normalizeLogisticsEvent,logisticsEventTypes} from '../domain/operations-interoperability.mjs';
import {createDocumentExtensions} from '../domain/operations-documents.mjs';
const code=value=>error=>error.code===value;
test('B55 canonical versioned contracts map all six report types to evidence without mutating source records',async t=>{
 const f=await fixture(t),load=f.assign();Object.assign(f.ops.extensions,createDocumentExtensions());
 const doc=f.command(f.dispatcher,'document:ingest',load,{type:'other',mimeType:'text/plain',content:'Illustrative local document'});
 const examples={
  shipment:{status:'delivered'},driver:{driverId:f.driver.id,available:false},vehicle:{vehicleId:f.vehicle.id,maintenance:'out_of_service'},
  milestone:{stopId:load.stops[0].id,milestone:'arrived'},document:{documentId:doc.id,contentHash:doc.contentHash,status:'received'},
  delivery:{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'illustrative-delivery-001'}
 };
 for(const type of logisticsEventTypes){
  const normalized=normalizeLogisticsEvent(f.ops,f.dispatcher,load,{schemaVersion:1,externalId:'canonical-'+type,type,occurredAt:f.ops.now().toISOString(),data:examples[type]});
  assert.equal(normalized.type,type);assert.equal(normalized.applied,false);assert.equal(normalized.verification,'provider_reported_unverified');assert.equal(normalized.requiresHumanReview,true);
 }
 assert.deepEqual(f.store.get('load',load.id,load.tenantId),load);assert.equal(f.store.get('driver',f.driver.id,load.tenantId).available,true);
 assert.equal(f.store.get('vehicle',f.vehicle.id,load.tenantId).maintenance,'ready');assert.equal(f.store.list('pod',load.tenantId).length,0);
});
test('B55 rejects unknown schema, relationship spoofing, raw signature/GPS, URLs and future reports',async t=>{
 const f=await fixture(t),load=f.assign(),base={schemaVersion:1,externalId:'fixture-event',type:'shipment',occurredAt:f.ops.now().toISOString(),data:{status:'delayed'}};
 for(const patch of [{schemaVersion:2},{type:'execute_command'},{occurredAt:'2099-01-01T00:00:00.000Z'},{tenantId:f.outsider.tenantId},{type:'driver',data:{driverId:f.outsider.id,available:true}},{type:'vehicle',data:{vehicleId:'wrong',maintenance:'ready'}},{type:'milestone',data:{stopId:'wrong',milestone:'arrived'}},{type:'delivery',data:{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'https://example.invalid'}},{type:'delivery',data:{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'valid',signature:'raw'}},{type:'delivery',data:{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'valid',gps:{lat:1}}}]){
  assert.throws(()=>normalizeLogisticsEvent(f.ops,f.dispatcher,load,{...base,...patch}));
 }
 assert.throws(()=>normalizeLogisticsEvent(f.ops,f.otherDispatcher,load,base),code('FORBIDDEN'));
 assert.throws(()=>normalizeLogisticsEvent(f.ops,f.outsider,load,base),code('FORBIDDEN'));
});
test('B55 document evidence cannot point to another shipment or falsify a document digest',async t=>{
 const f=await fixture(t),load=f.assign();Object.assign(f.ops.extensions,createDocumentExtensions());
 const other=f.createLoad(),doc=f.command(f.dispatcher,'document:ingest',other,{type:'other',mimeType:'text/plain',content:'Illustrative evidence'});
 const base={schemaVersion:1,externalId:'doc-wrong-load',type:'document',occurredAt:f.ops.now().toISOString(),data:{documentId:doc.id,contentHash:doc.contentHash,status:'received'}};
 assert.throws(()=>normalizeLogisticsEvent(f.ops,f.dispatcher,load,base),code('EVENT_DOCUMENT'));
 assert.throws(()=>normalizeLogisticsEvent(f.ops,f.dispatcher,other,{...base,data:{...base.data,contentHash:'0'.repeat(64)}}),code('EVENT_DOCUMENT'));
});
