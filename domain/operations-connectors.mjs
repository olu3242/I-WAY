import {authorize} from './authorization.mjs';
import {fields,text,integer,utc,requireValue} from './operations-errors.mjs';

export const connectorCapabilities=Object.freeze(['mapping','telematics','communications','accounting','logistics']);
const number=(value,min,max)=>{requireValue(typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max,'CONNECTOR_INPUT','Provide a number within the supported bounds.');return value;};
function source(value,allowed){requireValue(allowed.includes(value),'CONNECTOR_SOURCE','Select an explicitly local or user-reported source.');return value;}
function past(value,now){const result=utc(value);requireValue(result<=now,'CONNECTOR_TIME','Observed evidence cannot be future-dated.');return result;}
// This boundary accepts data, never provider addresses, credentials, prompts, or executable tool names.
export function validateConnectorInput(ops,actor,load,capability,input){
 requireValue(connectorCapabilities.includes(capability),'CONNECTOR_CAPABILITY','Unsupported connector capability.');
 ops.guard(actor,'connector:request',load);ops.guard(actor,'load:view',load);const now=ops.now().toISOString();
 if(capability==='mapping'){
  fields(input,['source','distanceMiles','averageMph','handlingMinutes','departureAt']);
  return {source:source(input.source,['user_estimate','local_fixture']),distanceMiles:number(input.distanceMiles,0.1,10000),averageMph:number(input.averageMph,1,80),handlingMinutes:integer(input.handlingMinutes,0,1440),departureAt:utc(input.departureAt)};
 }
 if(capability==='telematics'){
  fields(input,['source','observedAt','progressPercent']);
  return {source:source(input.source,['user_reported','local_fixture']),observedAt:past(input.observedAt,now),progressPercent:number(input.progressPercent,0,100)};
 }
 if(capability==='communications'){
  fields(input,['source','template','recipientId']);source(input.source,['local_fixture']);
  requireValue(['shipment_status','document_review'].includes(input.template),'CONNECTOR_TEMPLATE','Choose a local notification template.');
  const recipient=ops.store.principal(text(input.recipientId,100));
  requireValue(recipient?.active&&authorize({actor:recipient,action:'load:view',resource:load}),'CONNECTOR_RECIPIENT','Recipient is not authorized for this shipment.',403);
  return {source:'local_fixture',template:input.template,recipientId:recipient.id};
 }
 if(capability==='accounting'){
  fields(input,['source','invoiceId']);source(input.source,['local_fixture']);ops.guard(actor,'billing:manage',load);
  const invoice=ops.read('invoice',text(input.invoiceId,100),actor);
  requireValue(invoice.loadId===load.id&&invoice.status!=='void','CONNECTOR_INVOICE','Choose a current financial record on this shipment.',409);
  return {source:'local_fixture',invoiceId:invoice.id};
 }
 fields(input,['source','event','occurredAt']);
 requireValue(['arrived_pickup','arrived_delivery','delay'].includes(input.event),'CONNECTOR_EVENT','Choose a supported reported event.');
 return {source:source(input.source,['user_reported','local_fixture']),event:input.event,occurredAt:past(input.occurredAt,now)};
}
export function connectorSnapshot(ops,actor,load,job){
 const input=validateConnectorInput(ops,actor,load,job.capability,job.input);
 const snapshot={loadId:load.id,loadVersion:load.version,status:load.status};
 if(job.capability==='accounting'){
  const invoice=ops.read('invoice',input.invoiceId,actor);
  Object.assign(snapshot,{invoiceId:invoice.id,invoiceVersion:invoice.version,currency:invoice.currency,totalCents:invoice.totalCents,invoiceStatus:invoice.status});
 }
 return {input,snapshot};
}
function localResult(capability,input,snapshot){
 if(capability==='mapping'){
  const travelMinutes=input.distanceMiles/input.averageMph*60+input.handlingMinutes;
  return {distanceMiles:input.distanceMiles,travelMinutes,etaAt:new Date(Date.parse(input.departureAt)+travelMinutes*60000).toISOString(),estimated:true};
 }
 if(capability==='telematics')return {observedAt:input.observedAt,progressPercent:input.progressPercent,verification:'unverified_report'};
 if(capability==='communications')return {recipientId:input.recipientId,template:input.template,status:'local_recorded',externalDelivery:false};
 if(capability==='accounting')return {invoiceId:snapshot.invoiceId,invoiceVersion:snapshot.invoiceVersion,currency:snapshot.currency,totalCents:snapshot.totalCents,status:'local_export_prepared',externalTransaction:false};
 return {event:input.event,occurredAt:input.occurredAt,status:'evidence_only',applied:false};
}
export const localConnectorAdapters=Object.freeze(Object.fromEntries(connectorCapabilities.map(capability=>[capability,Object.freeze({
 mode:'local-only',provider:'local-fixture',version:'1',model:null,
 execute:async({input,snapshot})=>localResult(capability,input,snapshot)
})])));
export function validateConnectorResult(capability,input,snapshot,result){
 const expected=localResult(capability,input,snapshot);
 fields(result,Object.keys(expected));
 requireValue(Object.keys(result).length===Object.keys(expected).length&&Object.entries(expected).every(([key,value])=>result[key]===value),'CONNECTOR_RESULT','Local adapter output failed its contract.',503);
 return result;
}
export function connectorBinding(capability,inputSource,adapters=localConnectorAdapters){
 const adapter=adapters[capability];
 requireValue(adapter?.mode==='local-only'&&adapter.model===null&&typeof adapter.execute==='function','CONNECTOR_ADAPTER','An approved local-only adapter is required.',503);
 requireValue(/^[a-z0-9-]{1,40}$/.test(adapter.provider)&&/^[a-zA-Z0-9.-]{1,30}$/.test(adapter.version),'CONNECTOR_PROVENANCE','Invalid adapter provenance.',503);
 return {provider:adapter.provider,version:adapter.version,model:null,source:inputSource,live:false};
}
// Server adapters are intentionally restricted to local-only implementations until a separate live integration gate is approved.
export async function invokeConnector(capability,context,{adapters=localConnectorAdapters,timeoutMs=2000}={}){
 requireValue(connectorCapabilities.includes(capability),'CONNECTOR_CAPABILITY','Unsupported connector capability.');
 const adapter=adapters[capability],provenance=connectorBinding(capability,context.input.source,adapters);
 integer(timeoutMs,1,10000);
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Local adapter timed out'),{code:'CONNECTOR_TIMEOUT',transient:true})),timeoutMs)});
 try{
  const result=await Promise.race([Promise.resolve().then(()=>adapter.execute(Object.freeze({input:Object.freeze({...context.input}),snapshot:Object.freeze({...context.snapshot}),idempotencyKey:context.idempotencyKey}))),timeout]);
  return {data:validateConnectorResult(capability,context.input,context.snapshot,result),provenance};
 }finally{clearTimeout(timer)}
}
