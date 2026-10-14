import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createDocumentAdapterExtensions,invokeDocumentProvider,localTextDocumentAdapter,documentProviderContract} from '../domain/operations-document-adapters.mjs';
import {readDocument} from '../domain/operations-documents.mjs';
const code=value=>error=>error.code===value;
function install(f,options){Object.assign(f.ops.extensions,createDocumentAdapterExtensions(options));return f}
function body(load,patch={}){return JSON.stringify({loadReference:load.reference,shipper:'Illustrative origin',consignee:'Illustrative destination',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location,...patch})}
function ingest(f,load,payload={},key){return f.command(f.dispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:body(load),...payload},key)}
test('B47 adapter-backed ingestion reuses durable idempotency and requires the existing human review',async t=>{
 let calls=0,received;const adapter={...localTextDocumentAdapter,provider:'isolated-text-fixture',extract:request=>{calls++;received=request;return localTextDocumentAdapter.extract(request)}};
 const f=install(await fixture(t),{adapter}),load=f.createLoad(),document=ingest(f,load,{},'document-adapter-replay');
 assert.equal(document.status,'pending_review');assert.equal(document.processing.provider,'isolated-text-fixture');assert.equal(document.processing.live,false);assert.equal(document.processing.model,null);assert.equal(document.processing.reviewRequired,true);
 assert.deepEqual(ingest(f,load,{},'document-adapter-replay'),document);assert.equal(calls,1);
 assert.deepEqual(Object.keys(received).sort(),['document','idempotencyKey','schemaVersion','shipment']);
 assert.deepEqual(Object.keys(received.shipment).sort(),['commodity','reference','stops','weightLb']);assert.equal(Object.isFrozen(received.shipment.stops[0]),true);
 assert.equal(Object.hasOwn(received,'actor'),false);assert.equal(Object.hasOwn(received,'tenantId'),false);
 assert.equal(readDocument(f.ops,f.dispatcher,document.id).content,body(load));
 const reviewed=f.command(f.dispatcher,'document:review',document,{decision:'validate',reason:'Source and extraction checked by a human'});assert.equal(reviewed.status,'validated');
 assert.equal(documentProviderContract.externalProvidersEnabled,false);
});
test('B47 extracted evidence cannot forge provenance, approve itself or silently fix mismatched source fields',async t=>{
 const f=install(await fixture(t)),load=f.createLoad(),document=ingest(f,load,{content:body(load,{loadReference:'ILL-WRONG-SHIPMENT'})});
 assert.ok(document.extraction.mismatches.includes('loadReference'));assert.equal(document.extraction.confidence,'low');
 assert.throws(()=>f.command(f.dispatcher,'document:review',document,{decision:'validate',reason:'Cannot waive mismatched references'}),code('DOCUMENT_INVALID'));
 const second=f.createLoad();Object.assign(f.ops.extensions,createDocumentAdapterExtensions({fallbackOnFailure:false,adapter:{...localTextDocumentAdapter,extract:request=>({...localTextDocumentAdapter.extract(request),status:'validated',provider:'external'})}}));
 assert.throws(()=>ingest(f,second),code('DOCUMENT_PROVIDER_SCHEMA'));
 assert.equal(f.store.list('document',f.manager.tenantId).length,1);
});
test('B47 failed local adapter uses explicit deterministic fallback without persisting raw provider errors',async t=>{
 const marker='SYNTHETIC-PROVIDER-FAILURE-MUST-NOT-PERSIST',f=install(await fixture(t),{adapter:{...localTextDocumentAdapter,provider:'failing-local-fixture',extract:()=>{throw new Error(marker)}}}),load=f.createLoad();
 const result=ingest(f,load);
 assert.equal(result.processing.fallback,true);assert.equal(result.processing.provider,'local-text-parser');assert.equal(result.processing.attemptedProvider,'failing-local-fixture');assert.equal(result.processing.failureCode,'DOCUMENT_PROVIDER_FAILURE');assert.equal(result.status,'pending_review');
 assert.ok(!JSON.stringify(f.store.db.prepare('SELECT data FROM resources').all()).includes(marker));
 assert.ok(!JSON.stringify(f.store.db.prepare('SELECT detail FROM audit').all()).includes(marker));
 assert.equal(result.content,undefined);
});
test('B47 fail-closed adapter errors roll back all document side effects and preserve existing content',async t=>{
 const f=install(await fixture(t)),load=f.createLoad(),original=ingest(f,load);
 Object.assign(f.ops.extensions,createDocumentAdapterExtensions({fallbackOnFailure:false,adapter:{...localTextDocumentAdapter,extract:()=>{throw new Error('isolated fixture failure')}}}));
 assert.throws(()=>ingest(f,load,{previousDocId:original.id,content:body(load,{shipper:'Illustrative revision'})}),code('DOCUMENT_PROVIDER_FAILURE'));
 assert.equal(f.store.list('document',f.manager.tenantId).length,1);assert.equal(readDocument(f.ops,f.dispatcher,original.id).content,body(load));
});
test('B47 provider invocation enforces timeout, bounded schema and explicit non-live provenance',async t=>{
 const f=await fixture(t),load=f.createLoad();
 const good=await invokeDocumentProvider(body(load),'application/json','BOL',load);
 assert.equal(good.parsed.type,'BOL');assert.equal(good.processing.fallback,false);assert.ok(good.processing.latencyMs>=0);
 const slow={...localTextDocumentAdapter,extract:()=>new Promise(()=>{})};
 const fallback=await invokeDocumentProvider(body(load),'application/json','BOL',load,{adapter:slow,timeoutMs:5});
 assert.equal(fallback.processing.failureCode,'DOCUMENT_PROVIDER_TIMEOUT');assert.equal(fallback.processing.fallback,true);
 await assert.rejects(()=>invokeDocumentProvider(body(load),'application/json','BOL',load,{adapter:slow,timeoutMs:5,fallbackOnFailure:false}),code('DOCUMENT_PROVIDER_TIMEOUT'));
 await assert.rejects(()=>invokeDocumentProvider(body(load),'application/json','BOL',load,{adapter:{...localTextDocumentAdapter,mode:'live',extract:()=>{throw new Error('Must never call live adapter')}}}),code('DOCUMENT_PROVIDER_BLOCKED'));
 await assert.rejects(()=>invokeDocumentProvider('x'.repeat(32769),'text/plain','other',load),code('DOCUMENT_CONTENT'));
});
test('B47 async adapters cannot escape the synchronous transaction; fallback stays explicit',async t=>{
 const f=install(await fixture(t),{adapter:{...localTextDocumentAdapter,extract:async request=>localTextDocumentAdapter.extract(request)}}),load=f.createLoad();
 const document=ingest(f,load);assert.equal(document.processing.fallback,true);assert.equal(document.processing.failureCode,'DOCUMENT_PROVIDER_FAILURE');
 assert.equal(f.store.list('document',f.manager.tenantId).length,1);assert.equal(document.status,'pending_review');
});
test('B47 client-selected provider configuration and cross-tenant ingestion are rejected before adapter execution',async t=>{
 let calls=0;const f=install(await fixture(t),{adapter:{...localTextDocumentAdapter,extract:request=>{calls++;return localTextDocumentAdapter.extract(request)}}}),load=f.createLoad();
 for(const extras of [{provider:'external'},{apiKey:'illustrative-only'},{url:'https://unapproved.invalid'}])assert.throws(()=>ingest(f,load,extras),code('FIELDS'));
 assert.throws(()=>f.command(f.outsider,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:body(load)}),code('NOT_FOUND'));
 assert.throws(()=>f.command(f.otherDispatcher,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:body(load)}),code('FORBIDDEN'));
 assert.equal(calls,0);
});
