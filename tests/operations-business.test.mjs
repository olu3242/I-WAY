import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {createAutomation} from '../domain/operations-automation.mjs';
import {createDocumentExtensions} from '../domain/operations-documents.mjs';
import {createBusinessExtensions,runNotificationTick,businessSummary,businessState} from '../domain/operations-business.mjs';

const extensions=()=>({...createAutomation(),...createDocumentExtensions(),...createBusinessExtensions()});
const fresh=(f,kind,id)=>f.store.get(kind,id,f.manager.tenantId);
const setup=(t,options={})=>fixture(t,{extensions:extensions(),...options});
function transit(f){
 let load=f.assign();load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});return f.command(f.driver,'load:transit',load);
}
function bolContent(load){return JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops.at(-1).location});}
function bol(f,load){
 const doc=f.command(f.manager,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:bolContent(load)});
 return f.command(f.manager,'document:review',doc,{decision:'validate',reason:'Reviewed illustrative source'});
}
function delivered(f){
 let load=transit(f);bol(f,load);
 f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-POD-ONLY'});
 return f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-POD-ONLY'});
}
function issued(f){
 const load=delivered(f),ready=f.command(f.manager,'billing:generate',load),approved=f.command(f.manager,'finance:approve',ready,{reason:'Human reviews illustrative charges'});
 return {load,invoice:f.command(f.manager,'billing:issue',approved,{dueOn:'2099-12-01',reason:'Human authorizes local issuance'})};
}
function payment(f,invoice,extra={}){
 return f.command(f.manager,'payment:record',invoice,{amountCents:100000,currency:'USD',reference:'ILL-REF-'+randomUUID(),invoiceReference:invoice.invoiceReference,provenance:'local_fixture',receivedAt:'2026-01-01T12:00:00.000Z',...extra});
}

test('billing uses validated BOL and immutable ePOD before generating and issuing an exact-cent invoice',async t=>{
 const f=await setup(t);let load=transit(f);
 assert.throws(()=>f.command(f.manager,'billing:generate',load),e=>e.code==='INVOICE_STATE');
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'Legacy reference alone is insufficient'});
 assert.throws(()=>f.command(f.manager,'billing:generate',load),e=>e.code==='BILLING_DOCUMENTS');
 bol(f,load);assert.throws(()=>f.command(f.manager,'billing:generate',load),e=>e.code==='BILLING_DOCUMENTS');
 const pod=f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-POD-001'});
 const ready=f.command(f.manager,'billing:generate',load);
 assert.equal(ready.totalCents,275000);assert.deepEqual(ready.readinessEvidence.podIds,[pod.id]);
 assert.throws(()=>f.command(f.manager,'billing:generate',load),e=>e.code==='INVOICE_EXISTS');
 assert.throws(()=>f.command(f.manager,'billing:issue',ready,{dueOn:'2099-12-01',reason:'No approval'}),e=>e.code==='INVOICE_STATE');
 const approved=f.command(f.manager,'finance:approve',ready,{reason:'Human-reviewed commercial terms'});
 const command={action:'billing:issue',resourceId:approved.id,expectedVersion:approved.version,payload:{dueOn:'2099-12-01',reason:'Human-approved local invoice'},idempotencyKey:randomUUID()};
 const invoice=f.ops.execute(f.manager.id,command);
 assert.deepEqual(f.ops.execute(f.manager.id,command),invoice);
 assert.equal(invoice.status,'issued');assert.equal(invoice.outstandingCents,275000);
 assert.throws(()=>f.command(f.manager,'billing:issue',invoice,{dueOn:'2099-12-01',reason:'Duplicate'}),e=>e.code==='INVOICE_STATE');
 const reopened=new OperationsStore(f.path);try{assert.equal(reopened.get('invoice',invoice.id,f.manager.tenantId).invoiceReference,invoice.invoiceReference)}finally{reopened.close()}
});

test('billing and payment commands reject cross-tenant, driver, dispatcher, stale and forged financial input',async t=>{
 const f=await setup(t),{load,invoice}=issued(f);
 for(const actor of [f.driver,f.dispatcher,f.fleetUser]){
  assert.throws(()=>f.command(actor,'billing:generate',load),e=>e.status===403);
  assert.throws(()=>f.command(actor,'billing:void',invoice,{reason:'Denied'}),e=>e.status===403);
 }
 assert.throws(()=>f.command(f.outsider,'billing:void',invoice,{reason:'Denied'}),e=>e.status===404);
 assert.throws(()=>f.command(f.manager,'billing:void',{...invoice,version:1},{reason:'Stale'}),e=>e.code==='STALE');
 assert.throws(()=>f.command(f.manager,'billing:void',invoice,{reason:'Forged',totalCents:1}),e=>e.code==='FIELDS');
 assert.throws(()=>payment(f,invoice,{amountCents:0.01}),e=>e.code==='NUMBER');
 assert.throws(()=>payment(f,invoice,{currency:'EUR'}),e=>e.code==='CURRENCY');
 assert.throws(()=>payment(f,invoice,{provenance:'bank_verified'}),e=>e.code==='PROVENANCE');
 assert.throws(()=>payment(f,invoice,{receivedAt:'2099-01-01T00:00:00.000Z'}),e=>e.code==='PAYMENT_DATE');
});

test('payment matching records discrepancies without financial consequence and never logs full references',async t=>{
 const f=await setup(t),{invoice}=issued(f),reference='ILLUSTRATIVE-PRIVATE-PAYMENT-REFERENCE-9234';
 const unmatched=payment(f,invoice,{reference,invoiceReference:'not-this-invoice'});
 assert.deepEqual(unmatched.discrepancies,['INVOICE_REFERENCE_MISMATCH']);
 assert.equal(unmatched.status,'reported');assert.equal(fresh(f,'invoice',invoice.id).paidCents,0);
 assert.throws(()=>f.command(f.manager,'payment:reconcile',unmatched,{reason:'Mismatch remains'}),e=>e.code==='PAYMENT_MISMATCH');
 assert.throws(()=>payment(f,invoice,{reference:reference.toLowerCase()}),e=>e.code==='PAYMENT_DUPLICATE');
 const over=payment(f,invoice,{amountCents:300000});
 assert.deepEqual(over.discrepancies,['AMOUNT_EXCEEDS_BALANCE']);
 assert.throws(()=>f.command(f.manager,'payment:reconcile',over,{reason:'Cannot overpay'}),e=>e.code==='OVERPAYMENT');
 const audit=f.store.db.prepare("SELECT detail FROM audit WHERE action LIKE 'payment:%'").all();
 assert.ok(audit.every(r=>!r.detail.includes(reference)));
 assert.equal(unmatched.referenceHint,'…9234');assert.equal(Object.hasOwn(unmatched,'reference'),false);
});

test('human reconciliation is durable, exact, replay-safe, prevents overpayment and controls invoice voiding',async t=>{
 const f=await setup(t),{invoice}=issued(f),first=payment(f,invoice);
 assert.throws(()=>f.command(f.manager,'billing:void',invoice,{reason:'Cannot discard payment evidence'}),e=>e.code==='PAYMENT_EXISTS');
 const command={action:'payment:reconcile',resourceId:first.id,expectedVersion:first.version,payload:{reason:'Human matches illustrative ledger evidence'},idempotencyKey:randomUUID()};
 const result=f.ops.execute(f.manager.id,command);assert.deepEqual(f.ops.execute(f.manager.id,command),result);
 let current=fresh(f,'invoice',invoice.id);assert.equal(current.status,'partially_paid');assert.equal(current.outstandingCents,175000);
 assert.throws(()=>f.command(f.manager,'payment:reconcile',result,{reason:'Duplicate decision'}),e=>e.code==='PAYMENT_STATE');
 const second=payment(f,current,{amountCents:175000});f.command(f.manager,'payment:reconcile',second,{reason:'Human verifies remaining local evidence'});
 current=fresh(f,'invoice',invoice.id);assert.equal(current.status,'paid');assert.equal(current.paidCents,275000);assert.equal(current.outstandingCents,0);
 assert.throws(()=>f.command(f.manager,'billing:void',current,{reason:'Paid invoice cannot be voided'}),e=>e.code==='INVOICE_STATE');
 assert.throws(()=>payment(f,current),e=>e.code==='INVOICE_STATE');
 const reopened=new OperationsStore(f.path);try{assert.equal(reopened.get('invoice',invoice.id,f.manager.tenantId).status,'paid')}finally{reopened.close()}
 const summary=businessState(f.ops,f.manager,[fresh(f,'load',current.loadId)]);
 assert.equal(summary.receivables[0].outstandingCents,0);assert.match(summary.receivables[0].provenance,/no bank verification/);
 assert.deepEqual(businessState(f.ops,f.driver,[fresh(f,'load',current.loadId)]).payments,[]);
});

test('rejected local payment evidence permits audited voiding without deleting history',async t=>{
 const f=await setup(t),{invoice}=issued(f),reported=payment(f,invoice);
 const rejected=f.command(f.manager,'payment:reject',reported,{reason:'Illustrative evidence was entered against wrong invoice'});
 assert.equal(rejected.status,'rejected');
 const result=f.command(f.manager,'billing:void',invoice,{reason:'Commercial cancellation reviewed'});
 assert.equal(result.status,'void');assert.equal(f.store.list('invoice',f.manager.tenantId).length,1);assert.equal(f.store.list('payment',f.manager.tenantId).length,1);
 assert.throws(()=>f.command(f.manager,'payment:reject',rejected,{reason:'Already rejected'}),e=>e.code==='PAYMENT_STATE');
});

test('two real processes can reconcile only the remaining exact balance',async t=>{
 const f=await setup(t),{invoice}=issued(f),payments=[payment(f,invoice,{amountCents:200000}),payment(f,invoice,{amountCents:200000})];
 const code="import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {createBusinessExtensions} from './domain/operations-business.mjs';const s=new OperationsStore(process.argv[1]),ops=new Operations(s,{extensions:createBusinessExtensions()});try{ops.execute(process.argv[2],JSON.parse(process.argv[3]));console.log(JSON.stringify({ok:true}))}catch(e){console.log(JSON.stringify({code:e.code}))}finally{s.close()}";
 const run=p=>new Promise((resolve,reject)=>{
  const c={action:'payment:reconcile',resourceId:p.id,expectedVersion:p.version,payload:{reason:'Independent local human reconciliation'},idempotencyKey:randomUUID()};
  const child=spawn(process.execPath,['--input-type=module','-e',code,f.path,f.manager.id,JSON.stringify(c)],{windowsHide:true,stdio:['ignore','pipe','ignore']});let output='';
  child.stdout.on('data',d=>output+=d);child.on('error',reject);child.on('exit',()=>{try{resolve(JSON.parse(output))}catch{reject(new Error('Reconciliation worker failed'))}});
 });
 const results=await Promise.all(payments.map(run));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>r.code==='OVERPAYMENT').length,1);
 assert.equal(fresh(f,'invoice',invoice.id).paidCents,200000);
});

test('notifications are event-triggered, role-scoped, deduplicated and explicitly local recorded evidence',async t=>{
 const f=await setup(t),{load,invoice}=issued(f);
 const customer=f.store.insert('customer',f.manager.tenantId,{name:'Illustrative customer',active:true});
 const customerUser=addUser(f.store,{tenantId:f.manager.tenantId,username:'customer-notify@illustrative.invalid',name:'Illustrative customer user',role:'customer',customerId:customer.id,password});
 const current=f.store.update('load',load.id,f.manager.tenantId,load.version,{customerId:customer.id});
 const pref=f.command(f.driver,'notification:preferences',null,{enabled:false,templates:['load_delivered']});
 assert.equal(pref.userId,f.driver.id);
 runNotificationTick(f.ops);const notifications=f.store.list('notification',f.manager.tenantId);
 assert.ok(notifications.some(n=>n.template==='invoice_issued'&&n.recipientId===customerUser.id));
 assert.ok(notifications.some(n=>n.template==='load_delivered'&&n.recipientId===f.driver.id&&n.status==='suppressed'));
 assert.ok(notifications.every(n=>n.recipientId!==f.outsider.id&&n.recipientId!==f.otherDispatcher.id));
 assert.ok(notifications.filter(n=>n.template==='invoice_issued').every(n=>[f.manager.id,customerUser.id].includes(n.recipientId)));
 assert.ok(notifications.every(n=>n.externalDelivery===false&&['local_recorded','suppressed'].includes(n.status)));
 assert.ok(notifications.every(n=>!JSON.stringify(n).includes('275000')&&!JSON.stringify(n).includes('Illustrative Customer')));
 assert.equal(runNotificationTick(f.ops),0);assert.equal(f.store.list('notification',f.manager.tenantId).length,notifications.length);
 const visible=businessState(f.ops,customerUser,[current]).notifications;assert.equal(visible.length,2);assert.ok(visible.every(n=>n.recipientId===customerUser.id));
 assert.equal(businessState(f.ops,f.outsider,[current]).notifications.length,0);
 assert.throws(()=>f.command(f.dispatcher,'notification:preferences',pref,{enabled:true,templates:['load_delivered']}),e=>e.code==='PREFERENCE');
 assert.equal(invoice.status,'issued');
});

test('document exception notifications contain no document body or extracted fields',async t=>{
 const f=await setup(t),load=f.createLoad();
 f.command(f.dispatcher,'document:scan',load);runNotificationTick(f.ops);
 const notifications=f.store.list('notification',f.manager.tenantId);
 assert.equal(notifications.filter(n=>n.template==='document_exception').length,2);
 assert.ok(notifications.every(n=>[f.manager.id,f.dispatcher.id].includes(n.recipientId)));
 assert.ok(notifications.every(n=>Object.keys(n).every(k=>!['content','extraction','customer','location'].includes(k))));
});

test('local notification retries back off, survive restart and stop in dead letters; human controls recovery',async t=>{
 let clock=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>clock});delivered(f);
 const failure={kind:'local-test',record:()=>{throw new Error('Synthetic adapter failure including values that must not be logged')}};
 runNotificationTick(f.ops,{adapter:failure});
 const first=f.store.list('notification',f.manager.tenantId)[0];assert.equal(first.status,'retry');assert.equal(first.attempts,1);
 assert.equal(runNotificationTick(f.ops,{adapter:failure}),0);
 const reopened=new OperationsStore(f.path);
 try{
  const ops=new Operations(reopened,{now:()=>clock,extensions:extensions()});clock=new Date(clock.getTime()+3000);runNotificationTick(ops,{adapter:failure});
  clock=new Date(clock.getTime()+5000);runNotificationTick(ops,{adapter:failure});
 }finally{reopened.close()}
 let dead=fresh(f,'notification',first.id);assert.equal(dead.status,'dead_letter');assert.equal(dead.attempts,3);assert.equal(dead.lastError,'LOCAL_ADAPTER_FAILURE');
 f.command(f.manager,'notification:retry',dead,{reason:'Local test adapter recovered'});
 runNotificationTick(f.ops);dead=fresh(f,'notification',first.id);assert.equal(dead.status,'local_recorded');assert.equal(dead.retryCycles,1);
 assert.throws(()=>runNotificationTick(f.ops,{adapter:{kind:'live-email',record:()=>{throw new Error('Must never run')}}}),e=>e.code==='ADAPTER');
});

test('preference changes and deactivated recipients suppress pending retries without delivering messages',async t=>{
 let clock=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>clock});delivered(f);
 runNotificationTick(f.ops,{adapter:{kind:'local-test',record:()=>{throw new Error('Synthetic temporary failure')}}});
 f.command(f.driver,'notification:preferences',null,{enabled:false,templates:['load_delivered']});
 f.command(f.manager,'user:deactivate',{id:f.dispatcher.id},{reason:'Illustrative deactivation'});
 clock=new Date(clock.getTime()+3000);runNotificationTick(f.ops);
 const rows=f.store.list('notification',f.manager.tenantId);
 assert.ok(rows.filter(n=>[f.driver.id,f.dispatcher.id].includes(n.recipientId)).every(n=>n.status==='suppressed'));
 assert.ok(rows.filter(n=>n.recipientId===f.manager.id).every(n=>n.status==='local_recorded'));
});

test('analytics use traceable actual milestones and explicit denominators; unrelated tenants and personas have no data',async t=>{
 let clock=new Date('2026-11-02T14:00:00.000Z');const f=await setup(t,{now:()=>clock});
 const empty=businessSummary(f.ops,f.manager,[]);assert.equal(empty.onTimeDelivery.value,null);assert.equal(empty.cycleTime.value,null);assert.equal(empty.invoiceReadiness.value,null);
 let load=transit(f);bol(f,load);clock=new Date('2026-11-03T15:00:00.000Z');
 f.command(f.driver,'pod:record',load,{stopId:load.stops.at(-1).id,recipientAcknowledged:true,evidenceReference:'ILL-ANALYTICS-POD'});
 load=f.command(f.driver,'load:deliver',load,{stopId:load.stops.at(-1).id,proofReference:'ILL-ANALYTICS-POD'});
 const second=transit(f);f.command(f.driver,'exception:report',second,{type:'delay',reason:'Illustrative observed delay'});
 const summary=businessSummary(f.ops,f.manager,[load,second]);
 assert.equal(summary.estimated,false);assert.equal(summary.onTimeDelivery.value,100);assert.equal(summary.onTimeDelivery.denominator,1);
 assert.equal(summary.cycleTime.value,25);assert.equal(summary.exceptionRate.value,50);assert.equal(summary.utilization.value,100);assert.equal(summary.invoiceReadiness.value,100);
 assert.equal(summary.onTimeDelivery.evidence[0].loadId,load.id);
 const dispatch=businessSummary(f.ops,f.dispatcher,[load,second]);assert.equal(dispatch.invoiceReadiness.value,null);
 assert.equal(businessSummary(f.ops,f.driver,[load,second]),null);
 assert.equal(businessSummary(f.ops,f.outsider,[load,second]).onTimeDelivery.denominator,0);
 assert.ok(!JSON.stringify(summary).includes('275000'));assert.ok(!JSON.stringify(summary).includes('Illustrative Customer'));
});

test('human payment rematching repairs reference discrepancies without changing amounts or settling automatically',async t=>{
 const f=await setup(t),{invoice}=issued(f),reported=payment(f,invoice,{invoiceReference:'incorrect-local-invoice'});
 assert.throws(()=>f.command(f.dispatcher,'payment:match',reported,{invoiceId:invoice.id,invoiceReference:invoice.invoiceReference,reason:'Denied'}),e=>e.status===403);
 assert.throws(()=>f.command(f.manager,'payment:match',reported,{invoiceId:invoice.id,invoiceReference:'still-wrong',reason:'No exact match'}),e=>e.code==='PAYMENT_MISMATCH');
 assert.throws(()=>f.command(f.manager,'payment:match',reported,{invoiceId:invoice.id,invoiceReference:invoice.invoiceReference,reason:'Forged amount',amountCents:1}),e=>e.code==='FIELDS');
 const matched=f.command(f.manager,'payment:match',reported,{invoiceId:invoice.id,invoiceReference:invoice.invoiceReference,reason:'Human checked correct local invoice reference'});
 assert.equal(matched.status,'reported');assert.equal(matched.amountCents,reported.amountCents);assert.equal(matched.referenceHash,reported.referenceHash);assert.deepEqual(matched.discrepancies,[]);
 assert.equal(fresh(f,'invoice',invoice.id).paidCents,0);
 const reconciled=f.command(f.manager,'payment:reconcile',matched,{reason:'Human verified corrected local evidence'});
 assert.equal(reconciled.status,'reconciled');
 assert.throws(()=>f.command(f.manager,'payment:match',reconciled,{invoiceId:invoice.id,invoiceReference:invoice.invoiceReference,reason:'Already finalized'}),e=>e.code==='PAYMENT_STATE');
});

test('new BOL revisions require renewed document review before an approved invoice can be issued',async t=>{
 const f=await setup(t),load=delivered(f),invoice=f.command(f.manager,'billing:generate',load),approved=f.command(f.manager,'finance:approve',invoice,{reason:'Commercial terms approved'});
 const doc=f.store.list('document',f.manager.tenantId)[0],content=JSON.parse(bolContent(load));content.shipper='Illustrative corrected shipper';
 const revision=f.command(f.manager,'document:ingest',load,{type:'BOL',mimeType:'application/json',content:JSON.stringify(content),previousDocId:doc.id});
 assert.throws(()=>f.command(f.manager,'billing:issue',approved,{dueOn:'2099-12-01',reason:'Cannot bypass pending review'}),e=>e.code==='BILLING_DOCUMENTS');
 const validated=f.command(f.manager,'document:review',revision,{decision:'validate',reason:'Human validates new source'});
 const issued=f.command(f.manager,'billing:issue',approved,{dueOn:'2099-12-01',reason:'Human issues after document review'});
 assert.deepEqual(issued.readinessEvidence.documentIds,[validated.id]);
});
