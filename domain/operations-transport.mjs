import {isIPv4} from 'node:net';
import {checkServerIdentity} from 'node:tls';
import {fields,integer,requireValue,OpsError} from './operations-errors.mjs';
import {verifyIntegrationEnvelope} from './operations-integration.mjs';

// No native network implementation is installed. This contract can only be
// exercised with explicitly supplied local fixture IO; runtime provider gates
// continue to reject live adapters. Retry/circuit ownership stays in integration.
export const transportPolicy=Object.freeze({mode:'local-only',liveTransport:'BLOCKED',externalDelivery:false,maxRequestBytes:24576,maxResponseBytes:16384,maxHeaderBytes:4096,maxTimeoutMs:10000});
const error=code=>new OpsError(503,code,'Local transport did not produce verified receipt evidence.');
const requireTransport=(ok,code)=>{if(!ok)throw error(code);};
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);

export function transportDestination(value){
 requireTransport(typeof value==='string'&&value.length<=512,'TRANSPORT_DESTINATION');
 let url;try{url=new URL(value)}catch{throw error('TRANSPORT_DESTINATION');}
 requireTransport(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&!url.port&&
  /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,63}$/.test(url.hostname)&&
  url.hostname.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))&&
  !/(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(url.hostname)&&
  /^\/[A-Za-z0-9/_-]{0,299}$/.test(url.pathname)&&url.href===value,'TRANSPORT_DESTINATION');
 return Object.freeze({hostname:url.hostname,path:url.pathname});
}

// Deliberately IPv4-only until an IPv6 policy is separately implemented/tested.
// Reject all non-public ranges, including metadata, documentation and multicast.
export function isPublicTransportAddress(address){
 if(!isIPv4(address))return false;
 const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||
  a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||
  a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}

export function verifyTransportReceipt(provider,request,receiptEnvelope,{now=Date.now()}={}){
 fields(request,['envelope','idempotencyKey','signal']);
 requireTransport(identifier(request.idempotencyKey),'TRANSPORT_REQUEST');
 const actor={tenantId:provider.tenantId};
 const sent=verifyIntegrationEnvelope([provider],actor,request.envelope,now);
 const verified=verifyIntegrationEnvelope([provider],actor,receiptEnvelope,now),receipt=verified.event;
 fields(receipt,['schemaVersion','externalId','receiptId','tenantId','idempotencyKey','eventHash','status','externalDelivery']);
 requireTransport(receipt.schemaVersion===1&&receipt.externalId===sent.event.externalId&&identifier(receipt.receiptId)&&
  receipt.tenantId===provider.tenantId&&receipt.idempotencyKey===request.idempotencyKey&&receipt.eventHash===sent.eventHash&&
  receipt.status==='fixture_received'&&receipt.externalDelivery===false,'TRANSPORT_RECEIPT');
 return Object.freeze({receiptId:receipt.receiptId,providerId:provider.id,tenantId:provider.tenantId,eventId:receipt.externalId,
  eventHash:receipt.eventHash,idempotencyKey:receipt.idempotencyKey,signatureVerified:true,signatureKeyId:receiptEnvelope.keyId,
  status:'fixture_received',externalDelivery:false,live:false});
}

function abortError(signal){return signal.reason instanceof OpsError?signal.reason:error('TRANSPORT_ABORTED');}
async function resolveAddress(io,hostname,signal){
 let remove;
 const aborted=new Promise((_,reject)=>{const onAbort=()=>reject(abortError(signal));signal.addEventListener('abort',onAbort,{once:true});remove=()=>signal.removeEventListener('abort',onAbort);if(signal.aborted)onAbort();});
 try{
  const addresses=await Promise.race([Promise.resolve().then(()=>{if(signal.aborted)throw abortError(signal);return io.lookup(hostname,{all:true,verbatim:true});}),aborted]);
  if(signal.aborted)throw abortError(signal);
  requireTransport(Array.isArray(addresses)&&addresses.length>0&&addresses.length<=16&&addresses.every(item=>item?.family===4&&isPublicTransportAddress(item.address)),'TRANSPORT_ADDRESS');
  return addresses[0].address;
 }finally{remove();}
}
function exchange(io,target,address,body,signal){return new Promise((resolve,reject)=>{
 let request,response,done=false,tlsVerified=false;
 const finish=(failure,result)=>{if(done)return;done=true;signal.removeEventListener('abort',onAbort);if(failure){response?.destroy();request?.destroy();reject(failure);}else resolve(result);};
 const onAbort=()=>finish(abortError(signal));
 signal.addEventListener('abort',onAbort,{once:true});
 if(signal.aborted){onAbort();return;}
 const options={protocol:'https:',hostname:target.hostname,port:443,path:target.path,method:'POST',family:4,
  agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:target.hostname,checkServerIdentity,maxHeaderSize:transportPolicy.maxHeaderBytes,
  lookup:(hostname,lookupOptions,callback)=>{
   if(hostname!==target.hostname)return callback(error('TRANSPORT_ADDRESS'));
   callback(null,...(lookupOptions?.all?[[{address,family:4}]]:[address,4]));
  },headers:{'Content-Type':'application/json','Accept':'application/json','Content-Length':Buffer.byteLength(body)}};
 try{
  request=io.request(options,incoming=>{
   response=incoming;response.on('error',()=>finish(error('TRANSPORT_RESPONSE')));response.on('aborted',()=>finish(error('TRANSPORT_RESPONSE')));
   if(done){response.destroy();return;}
   if(!tlsVerified)return finish(error('TRANSPORT_TLS'));
   if(response.statusCode!==200||response.headers.location!==undefined)return finish(error('TRANSPORT_STATUS'));
   if(response.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json'||
    response.headers['content-encoding']!==undefined&&response.headers['content-encoding']!=='identity')return finish(error('TRANSPORT_RESPONSE'));
   const length=response.headers['content-length'];
   if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>transportPolicy.maxResponseBytes))return finish(error('TRANSPORT_RESPONSE_SIZE'));
   let size=0;const chunks=[];
   response.on('data',chunk=>{if(done)return;const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.length;if(size>transportPolicy.maxResponseBytes)return finish(error('TRANSPORT_RESPONSE_SIZE'));chunks.push(bytes);});
   response.on('end',()=>{if(done)return;if(response.complete===false||length!==undefined&&Number(length)!==size)return finish(error('TRANSPORT_RESPONSE'));let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return finish(error('TRANSPORT_RESPONSE'));}finish(null,parsed);});
   response.on('close',()=>{if(!done)finish(error('TRANSPORT_RESPONSE'));});
  });
  request.on('error',()=>finish(error('TRANSPORT_TLS_OR_NETWORK')));
  request.once('socket',socket=>{
   socket.once('secureConnect',()=>{
    if(done)return;
    if(socket.encrypted!==true||socket.authorized!==true||socket.remoteAddress!==address)return finish(error('TRANSPORT_TLS'));
    tlsVerified=true;request.end(body);
   });
  });
 }catch{finish(error('TRANSPORT_TLS_OR_NETWORK'));}
});}

export function createFixtureHttpsAdapter({provider,destination,fixtureIO,timeoutMs=2000,now=()=>Date.now()}={}){
 const target=transportDestination(destination);integer(timeoutMs,1,transportPolicy.maxTimeoutMs);
 requireTransport(fixtureIO?.mode==='local-only'&&typeof fixtureIO.lookup==='function'&&typeof fixtureIO.request==='function','TRANSPORT_LIVE_BLOCKED');
 requireTransport(provider?.mode==='local-fixture'&&typeof now==='function','TRANSPORT_LIVE_BLOCKED');
 return Object.freeze({mode:'local-only',provider:'bounded-https-fixture',version:'1',deliver:async request=>{
  fields(request,['envelope','idempotencyKey','signal']);
  requireTransport(identifier(request.idempotencyKey),'TRANSPORT_REQUEST');
  verifyIntegrationEnvelope([provider],{tenantId:provider.tenantId},request.envelope,now());
  const body=JSON.stringify({envelope:request.envelope,idempotencyKey:request.idempotencyKey});
  requireTransport(Buffer.byteLength(body)<=transportPolicy.maxRequestBytes,'TRANSPORT_REQUEST_SIZE');
  const controller=new AbortController(),cancel=()=>controller.abort(error('TRANSPORT_ABORTED'));
  requireTransport(request.signal===undefined||request.signal instanceof AbortSignal,'TRANSPORT_REQUEST');
  request.signal?.addEventListener('abort',cancel,{once:true});if(request.signal?.aborted)cancel();
  const timer=setTimeout(()=>controller.abort(error('TRANSPORT_TIMEOUT')),timeoutMs);
  try{
   const address=await resolveAddress(fixtureIO,target.hostname,controller.signal);
   const receipt=await exchange(fixtureIO,target,address,body,controller.signal);
   verifyTransportReceipt(provider,request,receipt,{now:now()});
   return Object.freeze({status:'local_recorded',externalDelivery:false});
  }catch(failure){throw error(failure instanceof OpsError&&/^(?:TRANSPORT_|INTEGRATION_)/.test(failure.code)?failure.code:'TRANSPORT_FAILED');}
  finally{clearTimeout(timer);request.signal?.removeEventListener('abort',cancel);}
 }});
}
