import {createHash} from 'node:crypto';
import {authorize} from './authorization.mjs';
import {createAutomation} from './operations-automation.mjs';
import {shippingDocumentReadiness} from './operations-documents.mjs';
import {fields,text,integer,utc,requireValue} from './operations-errors.mjs';

const templates=Object.freeze({
<<<<<<< HEAD
 shipment_created:'A shipment has been created.',
 dispatch_confirmed:'Dispatch has been confirmed.',
 pickup_completed:'Pickup has been recorded.',
 in_transit:'The shipment is in transit.',
 operational_exception:'An operational exception needs review.',
 pod_available:'Delivery acknowledgment is available.',
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 load_delivered:'The shipment has a recorded delivery.',
 invoice_issued:'An invoice is available for review.',
 document_exception:'Shipping documents need review.'
});
<<<<<<< HEAD
const lifecycleTemplates=new Set(['shipment_created','dispatch_confirmed','pickup_completed','in_transit','operational_exception','pod_available']);
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
const humanRoles=['carrier','dispatcher','driver','fleet','customer'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const scope=actor=>({tenantId:actor.tenantId,fleetId:actor.fleetId,driverId:actor.id,customerId:actor.customerId,dispatcherId:actor.role==='dispatcher'?actor.id:undefined});
const can=(actor,action,resource)=>authorize({actor,action,resource});
function billingLoad(ops,actor,invoice){return ops.read('load',invoice.loadId,actor,'billing:manage');}
function invoiceEvidence(ops,actor,load){
 const readiness=shippingDocumentReadiness(ops,actor,load);
 requireValue(readiness.ready,'BILLING_DOCUMENTS','Validated shipping documents and delivery acknowledgments are required.',409);
 return {documentIds:readiness.documentIds,podIds:readiness.podIds};
}
function date(value){
 requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value,'DATE','Enter a valid calendar date.');
 return value;
}
function notificationLoad(ops,actor,n){return ops.read('load',n.loadId,actor,'notification:manage');}
function currentPreference(ops,actor){return ops.store.list('preference',actor.tenantId).find(p=>p.userId===actor.id);}
function eligibleRecipient(actor,load,template){
 if(!actor?.active||!humanRoles.includes(actor.role)||!can(actor,'load:view',load))return false;
 if(template==='invoice_issued')return ['carrier','customer'].includes(actor.role)&&can(actor,'invoice:view',load);
 if(template==='document_exception')return ['carrier','dispatcher'].includes(actor.role);
 return true;
}

export function createBusinessExtensions(){
 const finance=createAutomation();
 return {
  'billing:generate':(ops,actor,c)=>{
   fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'billing:manage');ops.version(load,c.expectedVersion);
   requireValue(load.status==='delivered','INVOICE_STATE','Only delivered shipments can be billed.',409);
   const evidence=invoiceEvidence(ops,actor,load);
   const invoice=finance['finance:prepare'](ops,actor,{...c,action:'finance:prepare'});
   return ops.change(actor,invoice,{readinessEvidence:evidence},c.action);
  },
  'billing:issue':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['dueOn','reason']);const reason=text(p.reason,300),dueOn=date(p.dueOn);
   const invoice=ops.read('invoice',c.resourceId,actor),load=billingLoad(ops,actor,invoice);ops.version(invoice,c.expectedVersion);
   requireValue(invoice.status==='approved','INVOICE_STATE','Human-approved invoices may be issued once.',409);
   requireValue(load.status==='delivered'&&invoice.loadVersion===load.version,'STALE','The delivered shipment changed; review the financial record.',409);
   const evidence=invoiceEvidence(ops,actor,load);
   requireValue(dueOn>=ops.localDate(actor),'DATE','The due date cannot precede the issue date.');
   return ops.change(actor,invoice,{status:'issued',invoiceReference:'INV-'+invoice.id,issuedBy:actor.id,issuedAt:ops.now().toISOString(),dueOn,paidCents:0,outstandingCents:invoice.totalCents,readinessEvidence:evidence},c.action,reason);
  },
  'billing:void':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),invoice=ops.read('invoice',c.resourceId,actor);billingLoad(ops,actor,invoice);ops.version(invoice,c.expectedVersion);
   requireValue(['ready','approved','issued'].includes(invoice.status),'INVOICE_STATE','This invoice cannot be voided.',409);
   requireValue(!ops.store.list('payment',actor.tenantId).some(p=>p.invoiceId===invoice.id&&p.status!=='rejected'),'PAYMENT_EXISTS','Resolve payment evidence before voiding this invoice.',409);
   return ops.change(actor,invoice,{status:'void',voidedBy:actor.id,voidedAt:ops.now().toISOString()},c.action,reason);
  },
  'payment:record':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['amountCents','currency','reference','invoiceReference','provenance','receivedAt']);
   const invoice=ops.read('invoice',c.resourceId,actor),load=billingLoad(ops,actor,invoice);ops.version(invoice,c.expectedVersion);
   requireValue(['issued','partially_paid'].includes(invoice.status),'INVOICE_STATE','Payment evidence requires an outstanding issued invoice.',409);
   const amountCents=integer(p.amountCents,1,Number.MAX_SAFE_INTEGER);
   requireValue(p.currency===invoice.currency,'CURRENCY','Payment currency must match the invoice.');
   requireValue(['user_reported','local_fixture'].includes(p.provenance),'PROVENANCE','Payment evidence must identify its local or user-reported source.');
   const reference=text(p.reference,120).trim().toUpperCase(),referenceHash=hash(reference),invoiceReference=text(p.invoiceReference,100);
   requireValue(!ops.store.list('payment',actor.tenantId).some(x=>x.referenceHash===referenceHash),'PAYMENT_DUPLICATE','This payment reference already has evidence in this tenant.',409);
   const receivedAt=utc(p.receivedAt);requireValue(receivedAt<=ops.now().toISOString(),'PAYMENT_DATE','Payment evidence cannot be future-dated.');
   const discrepancies=[];if(invoiceReference!==invoice.invoiceReference)discrepancies.push('INVOICE_REFERENCE_MISMATCH');
   if(amountCents>invoice.outstandingCents)discrepancies.push('AMOUNT_EXCEEDS_BALANCE');
   return ops.create(actor,'payment',{loadId:load.id,invoiceId:invoice.id,amountCents,currency:p.currency,referenceHash,referenceHint:'…'+reference.slice(-4),referenceMatches:invoiceReference===invoice.invoiceReference,provenance:p.provenance,receivedAt,status:'reported',discrepancies,recordedBy:actor.id,recordedAt:ops.now().toISOString()},c.action);
  },
  'payment:match':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['invoiceId','invoiceReference','reason']);const reason=text(p.reason,300),payment=ops.read('payment',c.resourceId,actor);
   const previous=ops.read('invoice',payment.invoiceId,actor);billingLoad(ops,actor,previous);ops.version(payment,c.expectedVersion);
   requireValue(payment.status==='reported','PAYMENT_STATE','Only undecided payment evidence can be rematched.',409);
   const invoice=ops.read('invoice',text(p.invoiceId,100),actor),load=billingLoad(ops,actor,invoice);
   requireValue(['issued','partially_paid'].includes(invoice.status),'INVOICE_STATE','Select an outstanding issued invoice.',409);
   requireValue(text(p.invoiceReference,100)===invoice.invoiceReference&&payment.currency===invoice.currency,'PAYMENT_MISMATCH','The invoice reference and currency must match.',409);
   return ops.change(actor,payment,{invoiceId:invoice.id,loadId:load.id,referenceMatches:true,matchedBy:actor.id,matchedAt:ops.now().toISOString(),discrepancies:payment.amountCents>invoice.outstandingCents?['AMOUNT_EXCEEDS_BALANCE']:[]},c.action,reason);
  },
  'payment:reconcile':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),payment=ops.read('payment',c.resourceId,actor),invoice=ops.read('invoice',payment.invoiceId,actor);billingLoad(ops,actor,invoice);ops.version(payment,c.expectedVersion);
   requireValue(payment.status==='reported','PAYMENT_STATE','Payment evidence has already been decided.',409);
   requireValue(['issued','partially_paid'].includes(invoice.status),'INVOICE_STATE','The invoice is no longer outstanding.',409);
   requireValue(payment.referenceMatches&&payment.currency===invoice.currency,'PAYMENT_MISMATCH','Unmatched evidence cannot be reconciled.',409);
   requireValue(payment.amountCents<=invoice.outstandingCents,'OVERPAYMENT','Reconciliation would exceed the outstanding balance.',409);
   const paidCents=integer(invoice.paidCents+payment.amountCents,0,Number.MAX_SAFE_INTEGER),outstandingCents=invoice.totalCents-paidCents;
   ops.change(actor,invoice,{status:outstandingCents===0?'paid':'partially_paid',paidCents,outstandingCents,lastReconciledAt:ops.now().toISOString()},'invoice:reconcile',reason);
   return ops.change(actor,payment,{status:'reconciled',reconciledBy:actor.id,reconciledAt:ops.now().toISOString(),discrepancies:[]},c.action,reason);
  },
  'payment:reject':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),payment=ops.read('payment',c.resourceId,actor),invoice=ops.read('invoice',payment.invoiceId,actor);billingLoad(ops,actor,invoice);ops.version(payment,c.expectedVersion);
   requireValue(payment.status==='reported','PAYMENT_STATE','Only undecided payment evidence can be rejected.',409);
   return ops.change(actor,payment,{status:'rejected',rejectedBy:actor.id,rejectedAt:ops.now().toISOString()},c.action,reason);
  },
  'notification:preferences':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['enabled','templates']);ops.guard(actor,'notification:preferences',scope(actor));
   requireValue(typeof p.enabled==='boolean'&&Array.isArray(p.templates)&&p.templates.every(k=>Object.hasOwn(templates,k))&&new Set(p.templates).size===p.templates.length,'PREFERENCE','Choose valid notification preferences.');
   const existing=currentPreference(ops,actor),values={userId:actor.id,enabled:p.enabled,templates:p.templates,updatedAt:ops.now().toISOString()};
   if(existing){requireValue(c.resourceId===existing.id,'PREFERENCE','Use your existing preference record.',409);ops.version(existing,c.expectedVersion);return ops.change(actor,existing,values,c.action);}
   requireValue(!c.resourceId,'PREFERENCE','No preference record exists.',404);return ops.create(actor,'preference',values,c.action);
  },
  'notification:retry':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),n=ops.read('notification',c.resourceId,actor);notificationLoad(ops,actor,n);ops.version(n,c.expectedVersion);
   requireValue(n.status==='dead_letter','NOTIFICATION_STATE','Only dead-letter notifications can be retried.',409);
   return ops.change(actor,n,{status:'pending',attempts:0,nextAttemptAt:null,lastError:null,retryCycles:(n.retryCycles??0)+1},c.action,reason);
  },
  'notification:suppress':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),n=ops.read('notification',c.resourceId,actor);notificationLoad(ops,actor,n);ops.version(n,c.expectedVersion);
   requireValue(['pending','retry','dead_letter'].includes(n.status),'NOTIFICATION_STATE','Only unsent notification records can be suppressed.',409);
   return ops.change(actor,n,{status:'suppressed',suppressedAt:ops.now().toISOString()},c.action,reason);
  }
 };
}

export const localNotificationAdapter=Object.freeze({kind:'local-test',record:()=>({status:'local_recorded',adapter:'local-test'})});
// The isolated local adapter persists evidence only. No address, credential, or external send operation is accepted.
export function runNotificationTick(ops,{adapter=localNotificationAdapter}={}){
 requireValue(adapter?.kind==='local-test'&&typeof adapter.record==='function','ADAPTER','Only an isolated local notification adapter is enabled.',503);
 let changed=0;
 for(const tenant of ops.store.db.prepare('SELECT id FROM tenants').all()){
  const actor={id:'notification-service',tenantId:tenant.id,role:'automation',active:true,permissions:[]};
  ops.store.transaction(()=>{
   const now=ops.now().toISOString(),loads=ops.store.list('load',tenant.id),events=[];
   for(const l of loads)if(l.status==='delivered')events.push({template:'load_delivered',sourceId:l.id,eventKey:'delivered:'+l.id,loadId:l.id,at:l.stops.filter(s=>s.type==='delivery').at(-1)?.completedAt??now});
   for(const i of ops.store.list('invoice',tenant.id))if(i.issuedAt&&i.status!=='void')events.push({template:'invoice_issued',sourceId:i.id,eventKey:'invoice:'+i.id,loadId:i.loadId,at:i.issuedAt});
   for(const d of ops.store.list('documentexception',tenant.id))if(d.status==='open')events.push({template:'document_exception',sourceId:d.id,eventKey:'document-exception:'+d.id+':'+d.version,loadId:d.loadId,at:d.updatedAt??d.createdAt??now});
<<<<<<< HEAD
   // Read only the minimal metadata needed from committed events. Never render audit payloads.
   const eventTemplates={'load:create':'shipment_created','load:accept':'dispatch_confirmed','load:pickup':'pickup_completed','load:transit':'in_transit','exception:report':'operational_exception','pod:record':'pod_available'};
   for(const row of ops.store.db.prepare("SELECT id,action,resource_id,at,json_extract(detail,'$.loadId') AS load_id,json_extract(detail,'$.after.loadId') AS related_id FROM audit WHERE tenant_id=? AND outcome='success' AND action IN ('load:create','load:accept','load:pickup','load:transit','exception:report','pod:record') ORDER BY sequence").all(tenant.id))events.push({template:eventTemplates[row.action],sourceId:row.resource_id,eventKey:'lifecycle:'+row.id,loadId:row.load_id??row.related_id??row.resource_id,at:row.at});
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
   const principals=ops.store.db.prepare('SELECT data FROM users WHERE tenant_id=?').all(tenant.id).map(r=>JSON.parse(r.data)),existing=ops.store.list('notification',tenant.id),preferences=ops.store.list('preference',tenant.id);
   for(const e of events){
    const load=loads.find(l=>l.id===e.loadId);if(!load)continue;
    for(const recipient of principals.filter(p=>eligibleRecipient(p,load,e.template))){
     if(existing.some(n=>n.eventKey===e.eventKey&&n.recipientId===recipient.id))continue;
<<<<<<< HEAD
     const pref=preferences.find(p=>p.userId===recipient.id);
     // New lifecycle templates require explicit opt-in; existing templates keep their contract.
     if(lifecycleTemplates.has(e.template)&&!pref?.templates.includes(e.template))continue;
     const suppressed=pref&&(!pref.enabled||!pref.templates.includes(e.template));
     const result=ops.create(actor,'notification',{...e,recipientId:recipient.id,templateVersion:1,message:templates[e.template],status:suppressed?'suppressed':'pending',attempts:0,nextAttemptAt:null,createdAt:now,adapter:'local-test',externalDelivery:false,communicationPolicy:lifecycleTemplates.has(e.template)?'explicit_local_preference':'legacy_local_preference'},'notification:queue');
=======
     const pref=preferences.find(p=>p.userId===recipient.id),suppressed=pref&&(!pref.enabled||!pref.templates.includes(e.template));
     const result=ops.create(actor,'notification',{...e,recipientId:recipient.id,templateVersion:1,message:templates[e.template],status:suppressed?'suppressed':'pending',attempts:0,nextAttemptAt:null,createdAt:now,adapter:'local-test',externalDelivery:false},'notification:queue');
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
     existing.push(result);changed++;
    }
   }
  });
  for(const candidate of ops.store.list('notification',tenant.id).filter(n=>n.status==='pending'||n.status==='retry'&&n.nextAttemptAt<=ops.now().toISOString()).slice(0,50)){
   ops.store.transaction(()=>{
    const n=ops.read('notification',candidate.id,actor);if(n.version!==candidate.version)return;
    const recipient=ops.store.principal(n.recipientId),load=ops.store.list('load',tenant.id).find(l=>l.id===n.loadId),pref=recipient&&currentPreference(ops,recipient);
    if(!load||!eligibleRecipient(recipient,load,n.template)||pref&&(!pref.enabled||!pref.templates.includes(n.template))){
     ops.change(actor,n,{status:'suppressed',lastError:'RECIPIENT_UNAVAILABLE',suppressedAt:ops.now().toISOString()},'notification:suppressed');changed++;return;
    }
    try{
     const result=adapter.record({idempotencyKey:n.id,recipientId:n.recipientId,template:n.template,templateVersion:n.templateVersion,loadId:n.loadId,message:n.message});
     requireValue(result?.status==='local_recorded'&&result.adapter==='local-test','ADAPTER_RESULT','The local adapter returned an invalid result.',503);
     ops.change(actor,n,{status:'local_recorded',attempts:n.attempts+1,recordedAt:ops.now().toISOString(),nextAttemptAt:null,lastError:null},'notification:record');
    }catch{
     const attempts=n.attempts+1,retry=attempts<3;
     ops.change(actor,n,{status:retry?'retry':'dead_letter',attempts,lastError:'LOCAL_ADAPTER_FAILURE',nextAttemptAt:retry?new Date(ops.now().getTime()+1000*2**attempts).toISOString():null},'notification:failure');
    }
    changed++;
   });
  }
 }
 return changed;
}

export function businessState(ops,actor,visibleLoads){
 const ids=new Set(visibleLoads.map(l=>l.id));
 const allowedLoad=id=>ops.store.list('load',actor.tenantId).find(l=>l.id===id&&ids.has(id)&&can(actor,'load:view',l));
 const finance=can(actor,'billing:manage',scope(actor));
 return {
  payments:finance?ops.store.list('payment',actor.tenantId).filter(p=>allowedLoad(p.loadId)):[],
  preferences:ops.store.list('preference',actor.tenantId).filter(p=>p.userId===actor.id),
  notifications:ops.store.list('notification',actor.tenantId).filter(n=>{
   const load=allowedLoad(n.loadId);return load&&(n.recipientId===actor.id||can(actor,'notification:manage',load)&&eligibleRecipient(actor,load,n.template));
  }),
  receivables:finance?ops.store.list('invoice',actor.tenantId).filter(i=>allowedLoad(i.loadId)&&i.issuedAt&&i.status!=='void').map(i=>({invoiceId:i.id,loadId:i.loadId,currency:i.currency,status:i.status,totalCents:i.totalCents,paidCents:i.paidCents,outstandingCents:i.outstandingCents,dueOn:i.dueOn,provenance:'local invoice and human-reconciled reported evidence; no bank verification'})):[]
 };
}
function metric(numerator,denominator,unit,evidence,basis){return {value:denominator?numerator/denominator*(unit==='percent'?100:1):null,numerator,denominator,unit,evidence,basis};}
export function businessSummary(ops,actor,visibleLoads){
 if(!can(actor,'analytics:view',scope(actor)))return null;
 const ids=new Set(visibleLoads.map(l=>l.id)),loads=ops.store.list('load',actor.tenantId).filter(l=>ids.has(l.id)&&can(actor,'load:view',l)&&l.status!=='void');
 const delivery=[],cycles=[];
 for(const l of loads.filter(l=>l.status==='delivered')){
  const last=l.stops.filter(s=>s.type==='delivery').at(-1),first=l.stops.find(s=>s.type==='pickup'),actual=Date.parse(last?.completedAt),scheduled=Date.parse(last?.at),start=Date.parse(first?.completedAt);
  if(Number.isFinite(actual)&&Number.isFinite(scheduled))delivery.push({loadId:l.id,stopId:last.id,actualAt:last.completedAt,scheduledAt:last.at,onTime:actual<=scheduled});
  if(Number.isFinite(actual)&&Number.isFinite(start)&&actual>=start)cycles.push({loadId:l.id,pickupStopId:first.id,deliveryStopId:last.id,hours:(actual-start)/3600000});
 }
 const visible=new Set(loads.map(l=>l.id)),exceptions=ops.store.list('exception',actor.tenantId).filter(e=>visible.has(e.loadId)),affected=new Set(exceptions.map(e=>e.loadId));
 const vehicles=ops.store.list('vehicle',actor.tenantId).filter(v=>v.active&&can(actor,'asset:view',v));
 const vehicleIds=new Set(vehicles.map(v=>v.id)),claims=ops.store.list('assignment',actor.tenantId).filter(a=>a.status==='active'&&visible.has(a.loadId)&&vehicleIds.has(a.vehicleId));
 const activeVehicles=new Set(claims.map(a=>a.vehicleId)),readiness=[];
 if(can(actor,'billing:manage',scope(actor)))for(const l of loads.filter(l=>l.status==='delivered')){
  const result=shippingDocumentReadiness(ops,actor,l);readiness.push({loadId:l.id,ready:result.ready,documentIds:result.documentIds,podIds:result.podIds});
 }
 return {asOf:ops.now().toISOString(),source:'persisted local operational records',estimated:false,
  onTimeDelivery:metric(delivery.filter(x=>x.onTime).length,delivery.length,'percent',delivery,'Recorded final delivery completion compared with its scheduled timestamp; excludes missing completion timestamps.'),
  cycleTime:metric(cycles.reduce((n,x)=>n+x.hours,0),cycles.length,'hours',cycles,'Mean recorded first-pickup to final-delivery duration; excludes missing or reversed timestamps.'),
  exceptionRate:metric(affected.size,loads.length,'percent',exceptions.map(e=>({loadId:e.loadId,exceptionId:e.id,status:e.status})),'Distinct visible non-void shipments with at least one operational exception / all visible non-void shipments.'),
  utilization:metric(activeVehicles.size,vehicles.length,'percent',claims.map(a=>({assignmentId:a.id,vehicleId:a.vehicleId,loadId:a.loadId})),'Current visible active-assignment vehicles / active vehicles visible to this persona; snapshot, not historical hours or capacity utilization.'),
  invoiceReadiness:metric(readiness.filter(r=>r.ready).length,readiness.length,'percent',readiness,can(actor,'billing:manage',scope(actor))?'Delivered shipments with validated BOL and acknowledged delivery evidence / visible delivered shipments.':'Financial readiness is unavailable to this persona.')
 };
}
