import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {createDocumentExtensions,readDocument,shippingDocumentReadiness,documentIntegritySQL} from '../domain/operations-documents.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
const code=value=>error=>error.code===value;
function install(f){Object.assign(f.ops.extensions,createDocumentExtensions());f.store.db.exec(documentIntegritySQL);return f}
function bol(load,patch={}){
 return JSON.stringify({loadReference:load.reference,shipper:'Illustrative Shipper',consignee:'Illustrative Recipient',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops.find(s=>s.type==='pickup').location,deliveryLocation:load.stops.filter(s=>s.type==='delivery').at(-1).location,...patch});
}
function ingest(f,load,patch={}){
 return f.command(f.dispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:bol(load),...patch});
}
function transit(f){let load=f.assign();load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});return f.command(f.driver,'load:transit',load)}
test('B21 parses actual bounded local text and JSON with honest provenance, confidence and sanitized audits',async t=>{
 const f=install(await fixture(t)),load=f.createLoad(),body=bol(load);
 const document=ingest(f,load);
 assert.equal(document.type,'BOL');assert.equal(document.classification.source,'deterministic-content-parser');
 assert.equal(document.extraction.confidence,'high');assert.equal(document.status,'pending_review');
 assert.equal(document.content,undefined);assert.equal(document.extraction.fields,undefined);
 const read=readDocument(f.ops,f.dispatcher,document.id);
 assert.equal(read.content,body);assert.equal(read.extractedFields.loadReference,load.reference);
 const audit=JSON.stringify(f.store.db.prepare('SELECT detail FROM audit WHERE resource_id=?').all(document.id));
 assert.ok(!audit.includes('Illustrative Recipient'));assert.ok(!audit.includes('Illustrative Shipper'));assert.ok(!audit.includes('content"'));
 const commandResult=JSON.stringify(f.store.db.prepare('SELECT result FROM commands WHERE result LIKE ?').all('%'+document.id+'%'));
 assert.ok(!commandResult.includes('Illustrative Recipient'));
 const otherLoad=f.createLoad(),plain='Bill of lading\nLoad reference: '+otherLoad.reference+'\nShipper: Illustrative origin\nConsignee: Illustrative destination';
 const uncertain=f.command(f.dispatcher,'document:ingest',otherLoad,{type:'auto',mimeType:'text/plain',content:plain});
 assert.equal(uncertain.type,'BOL');assert.equal(uncertain.extraction.confidence,'low');assert.ok(uncertain.extraction.missing.includes('weightLb'));
 assert.throws(()=>f.command(f.dispatcher,'document:review',uncertain,{decision:'validate',reason:'Missing fields are not bypassable'}),code('DOCUMENT_INVALID'));
});
test('B22 immutable revisions require the latest same-load document and survive reopening',async t=>{
 const f=install(await fixture(t)),load=f.createLoad();
 const first=ingest(f,load),approved=f.command(f.dispatcher,'document:review',first,{decision:'validate',reason:'Verified against the shipment source'});
 const changed=bol(load,{shipper:'Illustrative corrected shipper'});
 const revised=ingest(f,load,{content:changed,previousDocId:first.id});
 assert.equal(revised.revision,2);assert.equal(revised.lineageId,first.lineageId);assert.equal(revised.status,'pending_review');
 assert.equal(f.store.get('document',first.id,f.manager.tenantId).content,bol(load));
 assert.equal(f.store.get('document',first.id,f.manager.tenantId).status,'validated');
 assert.ok(shippingDocumentReadiness(f.ops,f.manager,load).issues.includes('BOL_REVIEW_REQUIRED'));
 assert.throws(()=>ingest(f,load,{previousDocId:first.id,content:bol(load,{shipper:'Wrong old parent'})}),code('DOCUMENT_REVISION'));
 assert.throws(()=>ingest(f,f.createLoad(),{previousDocId:first.id}),code('DOCUMENT_LINK'));
 assert.throws(()=>ingest(f,load,{previousDocId:revised.id,content:changed}),code('DOCUMENT_DUPLICATE'));
 assert.throws(()=>f.command(f.dispatcher,'document:review',revised,{decision:'validate',reason:'Valid',content:'replace'}),code('FIELDS'));
 const reopened=new OperationsStore(f.path);
 try{const ops=new Operations(reopened,{extensions:createDocumentExtensions()});assert.equal(readDocument(ops,f.dispatcher,revised.id).content,changed);assert.equal(reopened.list('document',f.manager.tenantId).length,2)}finally{reopened.close()}
 assert.equal(approved.status,'validated');
});
test('B21 ingestion rejects unsupported content, forged fields and stale load versions',async t=>{
 const f=install(await fixture(t)),load=f.createLoad();
 for(const payload of [
  {mimeType:'application/pdf',content:'unprocessed PDF'},
  {mimeType:'text/plain',content:'a'.repeat(32769)},
  {mimeType:'text/plain',content:'text\u0000value'},
  {mimeType:'application/json',content:'{bad'},
  {mimeType:'application/json',content:'[]'},
  {mimeType:'application/json',content:'{"loadReference":{}}'},
  {mimeType:'text/plain',content:'Load reference: A\nLoad reference: B'}
 ])assert.throws(()=>ingest(f,load,payload));
 assert.throws(()=>ingest(f,load,{storagePath:'../../file'}),code('FIELDS'));
 assert.throws(()=>ingest(f,{...load,version:99}),code('STALE'));
 assert.equal(f.store.list('document',f.manager.tenantId).length,0);
});
test('B22 access enforces tenant, assigned dispatcher, driver relationship and human reviewer permissions',async t=>{
 const f=install(await fixture(t)),load=f.assign(),document=ingest(f,load);
 assert.equal(readDocument(f.ops,f.driver,document.id).id,document.id);
 assert.throws(()=>readDocument(f.ops,f.otherDispatcher,document.id),code('FORBIDDEN'));
 assert.throws(()=>readDocument(f.ops,f.outsider,document.id),code('NOT_FOUND'));
 assert.throws(()=>ingest({...f,dispatcher:f.otherDispatcher},load),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.driver,'document:review',document,{decision:'validate',reason:'Driver cannot validate commercial documents'}),code('FORBIDDEN'));
 const unassigned=f.createLoad();
 assert.throws(()=>f.command(f.driver,'document:ingest',unassigned,{type:'other',mimeType:'text/plain',content:'Unassigned document'}),code('FORBIDDEN'));
 assert.equal(f.store.get('document',document.id,f.manager.tenantId).status,'pending_review');
});
test('B24 missing and mismatched BOL exceptions escalate and resolve after a human-reviewed revision',async t=>{
 const f=install(await fixture(t)),load=f.createLoad();
 const missing=f.command(f.dispatcher,'document:scan',load);
 assert.deepEqual(missing.issueCodes,['MISSING_BOL']);assert.equal(missing.escalation,'dispatcher');
 const wrong=ingest(f,load,{content:bol(load,{loadReference:'WRONG-SHIPMENT'})});
 let open=f.store.list('documentexception',f.manager.tenantId).find(e=>e.status==='open');
 assert.equal(open.id,missing.id);assert.ok(open.issueCodes.includes('BOL_MISMATCH'));assert.equal(open.escalation,'carrier');
 assert.throws(()=>f.command(f.dispatcher,'document:review',wrong,{decision:'validate',reason:'Cannot override mismatched shipment'}),code('DOCUMENT_INVALID'));
 const rejected=f.command(f.dispatcher,'document:review',wrong,{decision:'reject',reason:'Source belongs to another shipment'});
 assert.equal(rejected.status,'rejected');
 const corrected=ingest(f,load,{previousDocId:wrong.id}),approved=f.command(f.dispatcher,'document:review',corrected,{decision:'validate',reason:'Correct source confirmed'});
 assert.equal(approved.status,'validated');
 open=f.store.get('documentexception',missing.id,f.manager.tenantId);assert.equal(open.status,'resolved');assert.ok(open.resolvedAt);
 assert.ok(f.store.db.prepare('SELECT action FROM audit WHERE resource_id=?').all(open.id).some(e=>e.action==='documentexception:resolve'));
 assert.throws(()=>f.command(f.dispatcher,'document:review',approved,{decision:'reject',reason:'Cannot replace a completed review'}),code('DOCUMENT_STATE'));
});
test('B23 ePOD requires recipient acknowledgment and assigned execution authority without accepting signatures or GPS',async t=>{
 const f=install(await fixture(t)),load=transit(f),stopId=load.stops.at(-1).id,payload={stopId,recipientAcknowledged:true,evidenceReference:'ILL-POD-001'};
 assert.throws(()=>f.command(f.otherDispatcher,'pod:record',load,payload),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.manager,'pod:record',load,payload),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.driver,'pod:record',load,{...payload,recipientAcknowledged:false}),code('POD_ACKNOWLEDGMENT'));
 assert.throws(()=>f.command(f.driver,'pod:record',load,{...payload,stopId:'stop-0'}),code('POD_STOP'));
 for(const extra of [{signature:'raw'},{latitude:41.1},{recipientName:'Not accepted'}])assert.throws(()=>f.command(f.driver,'pod:record',load,{...payload,...extra}),code('FIELDS'));
 const pod=f.command(f.driver,'pod:record',load,payload,'immutable-pod-replay');
 assert.equal(pod.recipientAcknowledged,true);assert.equal(pod.version,1);assert.ok(pod.recordedAt.endsWith('Z'));
 assert.deepEqual(f.command(f.driver,'pod:record',load,payload,'immutable-pod-replay'),pod);
 assert.throws(()=>f.command(f.dispatcher,'pod:record',load,payload),code('POD_EXISTS'));
 assert.throws(()=>f.command(f.driver,'pod:update',pod,{evidenceReference:'other'}),code('ACTION'));
 const event=f.store.list('deliveryevent',f.manager.tenantId);assert.equal(event.length,1);assert.equal(event[0].podId,pod.id);
 const audit=f.store.db.prepare('SELECT detail FROM audit WHERE resource_id=? AND outcome=?').get(pod.id,'success');
 assert.ok(!audit.detail.includes(payload.evidenceReference));assert.ok(audit.detail.includes('evidenceHash'));
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).status,'in_transit');
});
test('B23 dispatcher can record late ePOD for delivered loads and document readiness requires every delivery stop',async t=>{
 const f=install(await fixture(t));let load=transit(f);
 const document=ingest(f,load);f.command(f.dispatcher,'document:review',document,{decision:'validate',reason:'Shipping document verified'});
 assert.deepEqual(shippingDocumentReadiness(f.ops,f.manager,load).issues,['MISSING_POD']);
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-LEGACY-DELIVERY'});
 const missing=f.command(f.dispatcher,'document:scan',load);assert.ok(missing.issueCodes.includes('MISSING_POD'));
 f.command(f.dispatcher,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-LATE-POD'});
 assert.equal(shippingDocumentReadiness(f.ops,f.manager,load).ready,true);
 assert.equal(f.store.get('documentexception',missing.id,f.manager.tenantId).status,'resolved');
});

test('B22 customer document access requires its persisted shipment relationship and a latest validated BOL',async t=>{
 const f=install(await fixture(t)),customer=f.store.insert('customer',f.manager.tenantId,{name:'Illustrative customer',active:true});
 const reader=addUser(f.store,{tenantId:f.manager.tenantId,role:'customer',customerId:customer.id,username:'customer-docs@illustrative.invalid',name:'Illustrative customer reader',password});
 let load=f.createLoad();load=f.store.update('load',load.id,f.manager.tenantId,load.version,{customerId:customer.id});
 const doc=ingest(f,load);
 assert.throws(()=>readDocument(f.ops,reader,doc.id),code('DOCUMENT_ACCESS'));
 const validated=f.command(f.dispatcher,'document:review',doc,{decision:'validate',reason:'Safe customer shipment document verified'});
 assert.equal(readDocument(f.ops,reader,validated.id).id,validated.id);
 const another=ingest(f,f.createLoad());
 assert.throws(()=>readDocument(f.ops,reader,another.id),code('FORBIDDEN'));
 const revised=ingest(f,load,{previousDocId:doc.id,content:bol(load,{shipper:'Illustrative revised shipper'})});
 assert.throws(()=>readDocument(f.ops,reader,doc.id),code('DOCUMENT_ACCESS'));
 assert.throws(()=>readDocument(f.ops,reader,revised.id),code('DOCUMENT_ACCESS'));
 assert.throws(()=>f.command(reader,'document:ingest',load,{type:'other',mimeType:'text/plain',content:'Customer has no write authority'}),code('FORBIDDEN'));
 const other=f.command(f.dispatcher,'document:ingest',load,{type:'other',mimeType:'text/plain',content:'Illustrative internal note'});
 f.command(f.dispatcher,'document:review',other,{decision:'validate',reason:'Internal note reviewed'});
 assert.throws(()=>readDocument(f.ops,reader,other.id),code('DOCUMENT_ACCESS'));
});
test('B22/23 persistence boundary rejects content replacement and delivery evidence edits or deletion',async t=>{
 const f=install(await fixture(t)),load=transit(f),document=ingest(f,load);
 assert.throws(()=>f.store.update('document',document.id,f.manager.tenantId,document.version,{content:'tampered'}),/Document content is immutable/);
 assert.throws(()=>f.store.update('document',document.id,f.manager.tenantId,document.version,{contentHash:'tampered'}),/Document content is immutable/);
 assert.throws(()=>f.store.db.prepare('DELETE FROM resources WHERE kind=? AND id=?').run('document',document.id),/cannot be deleted/);
 const approved=f.command(f.dispatcher,'document:review',document,{decision:'validate',reason:'Approved without replacing evidence'});
 assert.equal(approved.status,'validated');
 const pod=f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-IMMUTABLE-POD'});
 for(const record of [pod,f.store.list('deliveryevent',f.manager.tenantId)[0]]){
  assert.throws(()=>f.store.update(record.kind,record.id,f.manager.tenantId,record.version,{recordedAt:'2000-01-01T00:00:00.000Z'}),/Delivery evidence is immutable/);
  assert.throws(()=>f.store.db.prepare('DELETE FROM resources WHERE kind=? AND id=?').run(record.kind,record.id),/cannot be deleted/);
 }
});
