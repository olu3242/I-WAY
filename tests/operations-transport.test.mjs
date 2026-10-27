import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createFixtureHttpsAdapter,transportDestination,isPublicTransportAddress,verifyTransportReceipt} from '../domain/operations-transport.mjs';
import {signFixtureEnvelope,verifyIntegrationEnvelope} from '../domain/operations-integration.mjs';
const now=()=>Date.parse('2026-10-12T12:00:00Z');
const provider={id:'fixture-partner',tenantId:'fixture-tenant',mode:'local-fixture',keys:{fixture_v1:Buffer.alloc(32,7)}};
const envelope=signFixtureEnvelope(provider,{schemaVersion:1,externalId:'fixture-event',type:'shipment',occurredAt:new Date(now()).toISOString(),data:{status:'delayed'}},{timestamp:now()});
const request={envelope,idempotencyKey:'fixture-command'};
function receipt(patch={}){return signFixtureEnvelope(provider,{schemaVersion:1,externalId:'fixture-event',receiptId:'fixture-receipt',tenantId:provider.tenantId,idempotencyKey:request.idempotencyKey,eventHash:verifyIntegrationEnvelope([provider],provider,envelope,now()).eventHash,status:'fixture_received',externalDelivery:false,...patch},{timestamp:now()});}
function io({status=200,partial=false,tls=true,oversized=false,hang=false}={}){return {mode:'local-only',lookup:async()=>[{address:'8.8.8.8',family:4}],request(options,callback){
 assert.equal(options.rejectUnauthorized,true);assert.equal(options.minVersion,'TLSv1.2');assert.equal(options.agent,false);
 const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{if(hang)return;const res=new EventEmitter();res.destroy=()=>{};res.statusCode=status;res.headers={'content-type':'application/json'};res.complete=!partial;callback(res);queueMicrotask(()=>{res.emit('data',oversized?'x'.repeat(17000):JSON.stringify(receipt()));res.emit('end');});};
 queueMicrotask(()=>{const socket=new EventEmitter();socket.encrypted=true;socket.authorized=tls;socket.remoteAddress='8.8.8.8';req.emit('socket',socket);socket.emit('secureConnect');});return req;
 }};}
const adapter=fixtureIO=>createFixtureHttpsAdapter({provider,destination:'https://example.com/fixture',fixtureIO,now,timeoutMs:25});
test('transport destination and DNS policy fail closed for credentials, redirects, local and reserved addresses',()=>{
 for(const url of ['http://example.com/','https://localhost/','https://example.com/?secret=x','https://user:password@example.com/','https://example.com:444/','https://127.0.0.1/'])assert.throws(()=>transportDestination(url));
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','198.18.0.1','::1','203.0.113.1'])assert.equal(isPublicTransportAddress(address),false);
 assert.throws(()=>createFixtureHttpsAdapter({provider,destination:'https://example.com/fixture'}),{code:'TRANSPORT_LIVE_BLOCKED'});
});
test('signed transport receipts bind tenant, idempotency key and exact event hash',()=>{
 assert.equal(verifyTransportReceipt(provider,request,receipt(),{now:now()}).signatureVerified,true);
 for(const patch of [{tenantId:'other'},{idempotencyKey:'other'},{eventHash:'0'.repeat(64)},{externalDelivery:true}])assert.throws(()=>verifyTransportReceipt(provider,request,receipt(patch),{now:now()}),{code:'TRANSPORT_RECEIPT'});
 assert.throws(()=>verifyTransportReceipt(provider,request,{...receipt(),signature:'0'.repeat(64)},{now:now()}));
});
test('simulated HTTPS validates TLS and complete bounded responses; normalizes rate limits, outage and partial response',async()=>{
 assert.deepEqual(await adapter(io()).deliver(request),{status:'local_recorded',externalDelivery:false});
 for(const [config,code] of [[{status:429},'TRANSPORT_STATUS'],[{status:503},'TRANSPORT_STATUS'],[{status:302},'TRANSPORT_STATUS'],[{partial:true},'TRANSPORT_RESPONSE'],[{tls:false},'TRANSPORT_TLS'],[{oversized:true},'TRANSPORT_RESPONSE_SIZE']])await assert.rejects(adapter(io(config)).deliver(request),{code});
});
test('simulated transport timeout, DNS rebinding and caller cancellation terminate without external delivery',async()=>{
 await assert.rejects(adapter(io({hang:true})).deliver(request),{code:'TRANSPORT_TIMEOUT'});
 const invalid=io();invalid.lookup=async()=>[{address:'127.0.0.1',family:4}];await assert.rejects(adapter(invalid).deliver(request),{code:'TRANSPORT_ADDRESS'});
 const controller=new AbortController();controller.abort();await assert.rejects(adapter(io()).deliver({...request,signal:controller.signal}),{code:'TRANSPORT_ABORTED'});
});
