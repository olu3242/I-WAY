import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createDocumentExtensions,parseDocumentContent} from './operations-documents.mjs';
import {OpsError,requireValue,integer} from './operations-errors.mjs';

export const documentProviderContract=Object.freeze({schemaVersion:1,allowedMimeTypes:Object.freeze(['text/plain','application/json']),maxBytes:32768,externalProvidersEnabled:false,reviewRequired:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value;}
function failure(code){return new OpsError(503,code,'Document processing did not complete with validated local evidence.');}
function context(content,mimeType,requestedType,load){
 requireValue(typeof content==='string'&&content.trim().length>0&&Buffer.byteLength(content)<=32768&&!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content),'DOCUMENT_CONTENT','Use a bounded plain text document without control characters.');
 requireValue(['text/plain','application/json'].includes(mimeType)&&['BOL','other','auto'].includes(requestedType),'DOCUMENT_FORMAT','Unsupported document type or media format.');
 const shipment={reference:load.reference,commodity:load.commodity,weightLb:load.weightLb,stops:load.stops.map(stop=>({type:stop.type,location:stop.location}))};
 const document={content,mimeType,requestedType,contentHash:hash(content)};
 return freeze({schemaVersion:1,document,shipment,idempotencyKey:hash(JSON.stringify(canonical({document,shipment,tenantId:load.tenantId,loadId:load.id})))});
}
function binding(adapter){
 requireValue(adapter?.mode==='local-only'&&adapter.model===null&&typeof adapter.extract==='function','DOCUMENT_PROVIDER_BLOCKED','Only a configured local document adapter is enabled.',503);
 requireValue(typeof adapter.provider==='string'&&/^[a-z0-9-]{1,40}$/.test(adapter.provider)&&typeof adapter.version==='string'&&/^[A-Za-z0-9.-]{1,30}$/.test(adapter.version),'DOCUMENT_PROVIDER_BLOCKED','Document adapter provenance is invalid.',503);
 return Object.freeze({provider:adapter.provider,version:adapter.version,model:null,mode:'local-only',live:false,contractVersion:1});
}
function expectedResult(request){return parseDocumentContent(request.document.content,request.document.mimeType,request.document.requestedType,request.shipment);}
function validateResult(request,result,expected){
 // Enabled local adapters must preserve the established parser's exact, reproducible extraction semantics.
 // A future approved OCR/model adapter requires its own normalization/evaluation gate, never a silent mode change.
 let serialized;try{serialized=JSON.stringify(canonical(result))}catch{throw failure('DOCUMENT_PROVIDER_SCHEMA')}
 if(typeof serialized!=='string'||Buffer.byteLength(serialized)>65536||serialized!==JSON.stringify(canonical(expected)))throw failure('DOCUMENT_PROVIDER_SCHEMA');
 return expected;
}
function metadata(request,provenance,start,extra={}){
 return {...provenance,contentHash:request.document.contentHash,idempotencyKey:request.idempotencyKey,reviewRequired:true,latencyMs:Math.max(0,performance.now()-start),fallback:false,...extra};
}
function fallback(request,start,error,attempted){
 const code=['DOCUMENT_PROVIDER_TIMEOUT','DOCUMENT_PROVIDER_SCHEMA'].includes(error?.code)?error.code:'DOCUMENT_PROVIDER_FAILURE';
 return {parsed:expectedResult(request),processing:metadata(request,binding(localTextDocumentAdapter),start,{fallback:true,failureCode:code,attemptedProvider:attempted.provider,attemptedVersion:attempted.version})};
}
export const localTextDocumentAdapter=Object.freeze({provider:'local-text-parser',version:'1',mode:'local-only',model:null,
 extract:request=>expectedResult(request)});
export function extractDocumentWithAdapter(content,mimeType,requestedType,load,{adapter=localTextDocumentAdapter,fallbackOnFailure=true}={}){
 const provenance=binding(adapter),request=context(content,mimeType,requestedType,load),expected=expectedResult(request),start=performance.now();
 try{
  const result=adapter.extract(request);
  if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw failure('DOCUMENT_PROVIDER_ASYNC')}
  return {...validateResult(request,result,expected),processing:metadata(request,provenance,start)};
 }catch(error){
  if(!fallbackOnFailure)throw failure(error?.code==='DOCUMENT_PROVIDER_SCHEMA'?'DOCUMENT_PROVIDER_SCHEMA':'DOCUMENT_PROVIDER_FAILURE');
  const recovered=fallback(request,start,error,provenance);return {...recovered.parsed,processing:recovered.processing};
 }
}
export async function invokeDocumentProvider(content,mimeType,requestedType,load,{adapter=localTextDocumentAdapter,fallbackOnFailure=true,timeoutMs=2000}={}){
 const provenance=binding(adapter),request=context(content,mimeType,requestedType,load),expected=expectedResult(request),start=performance.now();integer(timeoutMs,1,10000);
 let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('DOCUMENT_PROVIDER_TIMEOUT')),timeoutMs)});
 try{
  const result=await Promise.race([Promise.resolve().then(()=>adapter.extract(request)),deadline]);
  return {parsed:validateResult(request,result,expected),processing:metadata(request,provenance,start)};
 }catch(error){
  if(!fallbackOnFailure)throw failure(['DOCUMENT_PROVIDER_TIMEOUT','DOCUMENT_PROVIDER_SCHEMA'].includes(error?.code)?error.code:'DOCUMENT_PROVIDER_FAILURE');
  return fallback(request,start,error,provenance);
 }finally{clearTimeout(timer)}
}
export function createDocumentAdapterExtensions(options={}){
 // Existing application transaction, idempotency, content lineage, access control and human review remain authoritative.
 return createDocumentExtensions({extract:(content,mimeType,type,load)=>extractDocumentWithAdapter(content,mimeType,type,load,options)});
}
