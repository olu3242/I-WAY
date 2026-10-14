import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {runNotificationTick} from '../domain/operations-business.mjs';
test('concurrent tenant HTTP journeys close independently; API and SQLite scope deny all foreign evidence',async t=>{
 const cleanup=[],f=await fixture({after:fn=>cleanup.push(fn)},createOperationsFeatures());
 const b={manager:f.outsider};for(const role of ['dispatcher','driver'])b[role]=addUser(f.store,{tenantId:b.manager.tenantId,username:role+'-b@illustrative.invalid',name:'Illustrative '+role+' B',role,password});
 let dr=f.store.get('driver',b.driver.id,b.manager.tenantId);dr=f.command(b.manager,'driver:update',dr,{expiresOn:'2099-12-31',reason:'Synthetic eligibility'});f.command(b.manager,'driver:approve',dr,{approved:true,reason:'Synthetic carrier review'});
 b.vehicle=f.command(b.manager,'vehicle:create',null,{name:'Illustrative Truck B',capacityLb:45000});b.vehicle=f.command(b.manager,'vehicle:approve',b.vehicle,{approved:true,reason:'Synthetic carrier review'});
 const server=makeOperationsApp({store:f.store,operations:f.ops});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const fn of cleanup)await fn()});
 async function session(actor){const response=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:actor.username,password})});assert.equal(response.status,200);const data=await response.json();return {Origin:base,'Content-Type':'application/json',Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':data.csrf};}
 async function command(headers,action,resource,payload={},status=200,key=randomUUID()){const response=await fetch(base+'/api/ops/commands',{method:'POST',headers,body:JSON.stringify({action,resourceId:resource?.id,expectedVersion:resource?.version,payload,idempotencyKey:key})});const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;}
 async function journey(team,label){
  const manager=await session(team.manager),dispatcher=await session(team.dispatcher),driver=await session(team.driver);
  const customer=await command(manager,'customer:create',null,{name:'Illustrative customer '+label});
  const reader=await command(manager,'user:create',null,{username:'customer-'+label+'@illustrative.invalid',name:'Illustrative reader '+label,role:'customer',customerId:customer.id,password});
  await command(manager,'notification:preferences',null,{enabled:true,templates:['shipment_created','load_delivered','pod_available']});
  let load=await command(manager,'load:create',null,{reference:'ILL-'+label,customer:'Illustrative customer '+label,customerId:customer.id,dispatcherId:team.dispatcher.id,commodity:'Illustrative goods',weightLb:1000,rateCents:250000,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative origin',at:'2026-11-01T12:00:00Z'},{type:'delivery',location:'Illustrative destination',at:'2026-11-02T12:00:00Z'}]});
  load=await command(dispatcher,'load:validate',load);load=await command(dispatcher,'load:ready',load);
  let recommendation=await command(dispatcher,'capacity:recommend',load);assert.equal(recommendation.status,'pending');
  recommendation=await command(manager,'capacity:decide',recommendation,{decision:'approved',reason:'Human reviews eligible assignment'});
  await command(dispatcher,'capacity:apply',recommendation,{reason:'Apply human-approved proposal'});load=f.store.get('load',load.id,team.manager.tenantId);
  load=await command(driver,'load:accept',load);load=await command(driver,'load:pickup',load,{stopId:load.stops[0].id});load=await command(driver,'load:transit',load);
  const payload={location:'Illustrative waypoint',note:'Synthetic progress',externalId:'ILL-SHARED-ID',occurredAt:'2026-01-01T12:00:00Z'};
  const tracking=await command(driver,'tracking:record',load,payload);assert.equal((await command(driver,'tracking:record',load,payload)).id,tracking.id);
  const exception=await command(driver,'exception:report',load,{type:'integration_outage',reason:'Synthetic provider outage'});
  let workflow=f.store.list('workflow',team.manager.tenantId).find(w=>w.exceptionId===exception.id);workflow=await command(dispatcher,'workflow:advance',workflow);
  const approval=f.store.get('approval',workflow.approvalId,team.manager.tenantId);await command(manager,'approval:decide',approval,{decision:'approved',reason:'Human confirms safe recovery'});
  workflow=f.store.get('workflow',workflow.id,team.manager.tenantId);await command(dispatcher,'workflow:advance',workflow);
  const content=JSON.stringify({loadReference:load.reference,shipper:'Illustrative shipper',consignee:'Illustrative consignee',commodity:load.commodity,weightLb:load.weightLb,pickupLocation:load.stops[0].location,deliveryLocation:load.stops[1].location});
  let doc=await command(manager,'document:ingest',load,{type:'BOL',mimeType:'application/json',content});doc=await command(manager,'document:review',doc,{decision:'validate',reason:'Human verifies synthetic BOL'});
  await command(driver,'pod:record',load,{stopId:load.stops[1].id,recipientAcknowledged:true,evidenceReference:'ILL-POD-'+label});load=await command(driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'ILL-POD-'+label});
  load=await command(dispatcher,'load:close',load,{reason:'Human verifies delivery evidence'});assert.equal(load.lifecycleState,'closed');
  const customerHeaders=await session(reader),view=await (await fetch(base+'/api/ops/state',{headers:customerHeaders})).json();assert.equal(view.loads.length,1);assert.equal(view.loads[0].closedAt,load.closedAt);
  return {load,doc,workflow,approval,manager,dispatcher};
 }
 const [a,z]=await Promise.all([journey(f,'a'),journey(b,'b')]);runNotificationTick(f.ops);
 for(const [team,own,foreign] of [[f,a,z],[b,z,a]]){
  const view=await (await fetch(base+'/api/ops/state',{headers:own.manager})).json();assert.ok(!JSON.stringify(view).includes(foreign.load.id));assert.equal(view.loads.length,1);
  for(const kind of ['load','shipment','assignment','tracking','document','notification','workflow','approval'])for(const record of f.store.list(kind,foreign.load.tenantId))assert.throws(()=>f.store.get(kind,record.id,team.manager.tenantId),{code:'NOT_FOUND'});
  assert.equal((await fetch(base+'/api/ops/documents/'+foreign.doc.id,{headers:own.manager})).status,404);
  await command(own.dispatcher,'load:close',foreign.load,{reason:'Denied'},404);await command(own.manager,'approval:decide',foreign.approval,{decision:'approved',reason:'Denied'},404);await command(own.dispatcher,'workflow:advance',foreign.workflow,{},404);
  const ownAudit=new Set(f.store.db.prepare('SELECT sequence FROM audit WHERE tenant_id=?').all(team.manager.tenantId).map(r=>r.sequence));assert.ok(view.audit.length>0&&view.audit.every(row=>ownAudit.has(row.sequence)));
 }
 assert.equal(f.store.list('tracking',a.load.tenantId).length,1);assert.equal(f.store.list('tracking',z.load.tenantId).length,1);
});
