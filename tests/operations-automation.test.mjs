import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createAutomation,runWorkflowTick,payWeek} from '../domain/operations-automation.mjs';
const fresh=(f,kind,id)=>f.store.get(kind,id,f.manager.tenantId);
function transit(f){
 let load=f.assign();load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});return f.command(f.driver,'load:transit',load);
}
function report(f,load,actor=f.driver){return f.command(actor,'exception:report',load,{type:'delay',reason:'Illustrative closure requiring human review'});}
function workflow(f){return f.store.list('workflow',f.manager.tenantId).at(-1)}
function approval(f){return f.store.list('approval',f.manager.tenantId).at(-1)}
function deliver(f,load){return f.command(f.driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'illustrative-delivery-reference'})}
test('integrated shipment, tracking, recommendation, human approval, delivery and financial audit',async t=>{
 const f=await fixture(t);let load=transit(f);
 const tracking=f.command(f.driver,'tracking:record',load,{location:'Illustrative waypoint',note:'Illustrative position update'});
 const exception=report(f,load);
 assert.throws(()=>deliver(f,load),e=>e.code==='EXCEPTION');
 assert.equal(runWorkflowTick(f.ops),1);
 let a=approval(f),w=workflow(f);assert.equal(w.status,'waiting_approval');assert.equal(a.status,'pending');
 const recommendation=fresh(f,'recommendation',a.recommendationId);
 assert.equal(recommendation.source,'rules');assert.equal(recommendation.model,null);assert.ok(recommendation.explanation.includes('manager'));
 f.command(f.manager,'approval:decide',a,{decision:'approved',reason:'Illustrative manager confirms route reopened'});
 assert.equal(fresh(f,'exception',exception.id).status,'open');
 runWorkflowTick(f.ops);assert.equal(fresh(f,'exception',exception.id).status,'resolved');
 load=deliver(f,load);
 const invoice=f.command(f.manager,'finance:prepare',load);
 assert.equal(invoice.totalCents,275000);assert.equal(invoice.billTo,'Illustrative Customer');
 f.command(f.manager,'finance:approve',invoice,{reason:'Illustrative commercial terms reviewed'});
 assert.equal(fresh(f,'shipment',f.store.list('shipment',f.manager.tenantId)[0].id).status,'delivered');
 const audit=f.ops.state(f.manager.id).audit.map(a=>a.action);
 for(const action of ['load:create','load:validate','assignment:create','load:accept','load:pickup','load:transit','tracking:record','recommendation:create','approval:decide','exception:resolve','load:deliver','finance:prepare','finance:approve'])assert.ok(audit.includes(action),action);
 assert.equal(fresh(f,'tracking',tracking.id).recordedBy,f.driver.id);
 assert.equal(f.ops.state(f.driver.id).invoices.length,0);
});
test('automated worker cannot decide approval, dispatch or finance; tenant and relationship isolation',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);runWorkflowTick(f.ops);const a=approval(f);
 for(const actor of [f.driver,f.dispatcher,f.fleetUser])assert.throws(()=>f.command(actor,'approval:decide',a,{decision:'approved',reason:'Denied'}),e=>e.status===403);
 assert.throws(()=>f.command(f.outsider,'approval:decide',a,{decision:'approved',reason:'Denied'}),e=>e.status===404);
 assert.throws(()=>f.command(f.otherDispatcher,'workflow:advance',workflow(f)),e=>e.status===403);
 assert.throws(()=>f.command(f.manager,'user:create',null,{name:'Forbidden service',username:'service@illustrative.invalid',role:'automation',password:'illustrative-long-password'}),e=>e.code==='ACCOUNT');
 assert.equal(approval(f).status,'pending');
});
test('self approval, rejection, replay, and expired approvals cannot resolve an exception',async t=>{
 let clock=new Date('2026-11-02T14:00:00Z');const f=await fixture(t,{now:()=>clock}),load=transit(f);report(f,load,f.manager);runWorkflowTick(f.ops);
 assert.throws(()=>f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Self approval'}),e=>e.code==='SEPARATION');
 clock=new Date(clock.getTime()+31*60000);runWorkflowTick(f.ops);assert.equal(approval(f).status,'expired');assert.equal(workflow(f).status,'failed');
 assert.throws(()=>f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Late'}),e=>e.code==='APPROVAL_STATE');
 assert.equal(f.store.list('exception',f.manager.tenantId)[0].status,'open');
});
test('rejected approval can restart with a fresh recommendation and exactly-once decision',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);runWorkflowTick(f.ops);const original=approval(f);
 const command={action:'approval:decide',resourceId:original.id,expectedVersion:original.version,payload:{decision:'rejected',reason:'Need a renewed review'},idempotencyKey:randomUUID()};
 const rejected=f.ops.execute(f.manager.id,command);assert.deepEqual(f.ops.execute(f.manager.id,command),rejected);
 assert.throws(()=>f.command(f.manager,'approval:decide',rejected,{decision:'approved',reason:'Cannot replay'}),e=>e.code==='APPROVAL_STATE');
 f.command(f.dispatcher,'workflow:restart',workflow(f),{reason:'Route reopened; request new review'});runWorkflowTick(f.ops);
 assert.notEqual(approval(f).id,original.id);f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Reviewed new evidence'});runWorkflowTick(f.ops);
 assert.equal(workflow(f).status,'completed');
});
test('approval is invalidated if load changes before decision',async t=>{
 const f=await fixture(t);let load=f.assign();load=f.command(f.driver,'load:accept',load);report(f,load);runWorkflowTick(f.ops);
 // Reassignment is still allowed before pickup; previous recommendation cannot authorize the changed assignment.
 load=f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Reconfirm dispatch'});
 assert.throws(()=>f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Stale'}),e=>e.code==='STALE');
 runWorkflowTick(f.ops);assert.equal(approval(f).status,'stale');assert.equal(workflow(f).status,'failed');
});
test('changed eligibility after approval prevents automatic resolution',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);runWorkflowTick(f.ops);
 f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Eligible when reviewed'});
 f.command(f.manager,'vehicle:update',fresh(f,'vehicle',f.vehicle.id),{maintenance:'out_of_service',reason:'New breakdown'});
 runWorkflowTick(f.ops);assert.equal(workflow(f).status,'failed');assert.equal(f.store.list('exception',f.manager.tenantId)[0].status,'open');
});
test('hold recommendation leaves exception open and can be re-reviewed after repair',async t=>{
 const f=await fixture(t),load=transit(f);
 f.command(f.manager,'vehicle:update',fresh(f,'vehicle',f.vehicle.id),{maintenance:'out_of_service',reason:'Illustrative repair needed'});
 report(f,load);runWorkflowTick(f.ops);assert.equal(f.store.list('recommendation',f.manager.tenantId)[0].action,'hold_for_repair');
 f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Confirm shipment remains held'});runWorkflowTick(f.ops);
 assert.equal(workflow(f).status,'completed');assert.throws(()=>deliver(f,load),e=>e.code==='EXCEPTION');
 f.command(f.manager,'vehicle:update',fresh(f,'vehicle',f.vehicle.id),{maintenance:'ready',reason:'Repair independently verified'});
 f.command(f.dispatcher,'workflow:restart',workflow(f),{reason:'Repair complete'});runWorkflowTick(f.ops);
 f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Repair and route reviewed'});runWorkflowTick(f.ops);
 assert.equal(deliver(f,load).status,'delivered');
});
test('checkpoint retry survives store reopening and backoff prevents early retries',async t=>{
 let clock=new Date('2026-11-02T14:00:00Z');
 const f=await fixture(t,{now:()=>clock,extensions:createAutomation({step:()=>{throw Object.assign(new Error('fixture'),{transient:true})}})});
 const load=transit(f);report(f,load);runWorkflowTick(f.ops);assert.equal(workflow(f).status,'retry');
 assert.throws(()=>f.command(f.dispatcher,'workflow:advance',workflow(f)),e=>e.code==='RETRY_EARLY');
 const reopened=new OperationsStore(f.path);try{
  const recovered=new Operations(reopened,{now:()=>clock,extensions:createAutomation()});
  assert.equal(runWorkflowTick(recovered),0);clock=new Date(clock.getTime()+2001);assert.equal(runWorkflowTick(recovered),1);
  assert.equal(workflow(f).status,'waiting_approval');assert.equal(workflow(f).attempts,2);
 }finally{reopened.close()}
});
test('retry exhaustion is durable and never changes the shipment',async t=>{
 let clock=new Date('2026-11-02T14:00:00Z');const f=await fixture(t,{now:()=>clock,extensions:createAutomation({step:()=>{throw Object.assign(new Error('fixture'),{transient:true})}})});
 const load=transit(f);report(f,load);
 for(let i=0;i<3;i++){runWorkflowTick(f.ops);clock=new Date(clock.getTime()+10000)}
 assert.equal(workflow(f).status,'failed');assert.equal(workflow(f).attempts,3);assert.equal(approval(f),undefined);assert.equal(fresh(f,'load',load.id).version,load.version);
});
test('process interruption rolls back partial review, then another process recovers',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);
 const code="import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {createAutomation} from './domain/operations-automation.mjs';const s=new OperationsStore(process.argv[1]),ops=new Operations(s,{extensions:createAutomation()});const w=s.list('workflow',process.argv[2])[0];s.transaction(()=>{ops.extensions['workflow:advance'](ops,{id:'workflow-service',tenantId:process.argv[2],role:'automation',active:true,permissions:['workflow:run']},{resourceId:w.id,expectedVersion:w.version,payload:{}});process.exit(23)});";
 const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code,f.path,f.manager.tenantId,load.id],{stdio:'ignore'});child.on('error',reject);child.on('exit',resolve)});
 assert.equal(status,23);assert.equal(f.store.list('recommendation',f.manager.tenantId).length,0);assert.equal(f.store.list('approval',f.manager.tenantId).length,0);assert.equal(workflow(f).status,'pending');
 const reopened=new OperationsStore(f.path);try{assert.equal(runWorkflowTick(new Operations(reopened,{extensions:createAutomation()})),1)}finally{reopened.close()}
 assert.equal(workflow(f).status,'waiting_approval');assert.equal(f.store.list('recommendation',f.manager.tenantId).length,1);
});
test('duplicate tracking commands do not duplicate events; changed payload rejects reused key',async t=>{
 const f=await fixture(t),load=transit(f),key=randomUUID();
 const command={action:'tracking:record',resourceId:load.id,expectedVersion:load.version,idempotencyKey:key,payload:{location:'Illustrative waypoint',note:'Checked'}};
 f.ops.execute(f.driver.id,command);f.ops.execute(f.driver.id,command);assert.equal(f.store.list('tracking',f.manager.tenantId).length,1);
 assert.throws(()=>f.ops.execute(f.driver.id,{...command,payload:{...command.payload,note:'Different'}}),e=>e.code==='IDEMPOTENCY');
});
test('invoice readiness rejects unfinished loads, duplicates, unauthorized financial edits',async t=>{
 const f=await fixture(t);let load=transit(f);assert.throws(()=>f.command(f.manager,'finance:prepare',load),e=>e.code==='INVOICE_STATE');
 load=deliver(f,load);assert.throws(()=>f.command(f.dispatcher,'finance:prepare',load),e=>e.code==='FORBIDDEN');
 const invoice=f.command(f.manager,'finance:prepare',load);assert.throws(()=>f.command(f.manager,'finance:prepare',load),e=>e.code==='INVOICE_EXISTS');
 assert.throws(()=>f.command(f.manager,'finance:approve',invoice,{reason:'Review',totalCents:0}),e=>e.code==='FIELDS');
 const approved=f.command(f.manager,'finance:approve',invoice,{reason:'Approved charges'});
 assert.throws(()=>f.command(f.manager,'finance:approve',approved,{reason:'Repeat'}),e=>e.code==='INVOICE_STATE');
});
test('carrier time-zone pay week uses first pickup calendar date across UTC and DST boundaries',()=>{
 assert.equal(payWeek('2026-11-02T01:00:00Z','America/Chicago'),'2026-10-26');
 assert.equal(payWeek('2026-11-02T07:00:00Z','America/Chicago'),'2026-11-02');
 assert.equal(payWeek('2026-03-09T04:30:00Z','America/Chicago'),'2026-03-02');
});
test('expiry dates reject nonexistent calendar days',async t=>{
 const f=await fixture(t);assert.throws(()=>f.command(f.manager,'driver:update',fresh(f,'driver',f.driver.id),{expiresOn:'2027-02-30',reason:'Invalid date'}),e=>e.code==='EXPIRY');
});

test('concurrent human decisions commit one approval and one decision audit',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);runWorkflowTick(f.ops);const a=approval(f);
 const run=decision=>new Promise((resolve,reject)=>{
  const c={action:'approval:decide',resourceId:a.id,expectedVersion:a.version,idempotencyKey:randomUUID(),payload:{decision,reason:'Illustrative concurrent human review'}};
  const child=spawn(process.execPath,['tests/helpers/operations-worker.mjs',f.path,f.manager.id,JSON.stringify(c)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='';child.stdout.on('data',d=>out+=d);child.on('error',reject);child.on('exit',()=>{try{resolve(JSON.parse(out))}catch{reject(new Error('Worker failed'))}});
 });
 const results=await Promise.all([run('approved'),run('rejected')]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>r.code==='STALE').length,1);
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='approval:decide' AND outcome='success'").get().n,1);
});
test('two worker processes create one recommendation and one approval per checkpoint',async t=>{
 const f=await fixture(t),load=transit(f);report(f,load);
 const code="import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {createAutomation,runWorkflowTick} from './domain/operations-automation.mjs';const store=new OperationsStore(process.argv[1]);runWorkflowTick(new Operations(store,{extensions:createAutomation()}));store.close();";
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code,f.path],{windowsHide:true,stdio:'ignore'});child.on('error',reject);child.on('exit',resolve)});
 assert.deepEqual(await Promise.all([run(),run()]),[0,0]);
 assert.equal(f.store.list('recommendation',f.manager.tenantId).length,1);assert.equal(f.store.list('approval',f.manager.tenantId).length,1);
});
test('open exception prevents starting transit and expired approved work cannot apply',async t=>{
 let clock=new Date('2026-11-02T14:00:00Z');const f=await fixture(t,{now:()=>clock});let load=f.assign();
 load=f.command(f.driver,'load:accept',load);load=f.command(f.driver,'load:pickup',load,{stopId:load.stops[0].id});
 report(f,load);assert.throws(()=>f.command(f.driver,'load:transit',load),e=>e.code==='EXCEPTION');
 runWorkflowTick(f.ops);f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Reviewed'});
 clock=new Date(clock.getTime()+31*60000);runWorkflowTick(f.ops);
 assert.equal(workflow(f).status,'failed');assert.equal(approval(f).status,'expired');assert.equal(f.store.list('exception',f.manager.tenantId)[0].status,'open');
});

test('approved exception work fails closed when the persisted reviewer loses approval authority',async t=>{
 const f=await fixture(t),load=transit(f),exception=report(f,load);runWorkflowTick(f.ops);
 const approved=f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Independent review while authorized'});
 const reviewer=f.store.principal(f.manager.id);
 f.store.db.prepare('UPDATE users SET data=? WHERE id=? AND tenant_id=?').run(JSON.stringify({...reviewer,permissions:reviewer.permissions.filter(permission=>permission!=='approval:decide')}),reviewer.id,reviewer.tenantId);
 assert.equal(runWorkflowTick(f.ops),1);
 assert.equal(workflow(f).status,'failed');assert.equal(workflow(f).lastError,'APPROVAL_AUTHORITY');
 assert.equal(fresh(f,'approval',approved.id).status,'stale');assert.equal(fresh(f,'exception',exception.id).status,'open');
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='exception:resolve' AND resource_id=?").get(exception.id).n,0);
 // Restoring permission cannot revive consumed/stale evidence; a new human review is required.
 f.store.db.prepare('UPDATE users SET data=? WHERE id=? AND tenant_id=?').run(JSON.stringify(reviewer),reviewer.id,reviewer.tenantId);
 assert.equal(runWorkflowTick(f.ops),0);assert.equal(fresh(f,'exception',exception.id).status,'open');
 f.command(f.dispatcher,'workflow:restart',workflow(f),{reason:'Reviewer authority restored; request a fresh decision'});runWorkflowTick(f.ops);
 assert.notEqual(approval(f).id,approved.id);
 f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Fresh independent review under current authority'});runWorkflowTick(f.ops);
 assert.equal(fresh(f,'exception',exception.id).status,'resolved');
});
test('approved exception work fails closed when the reviewer is deactivated before application',async t=>{
 const f=await fixture(t),load=transit(f),exception=report(f,load);runWorkflowTick(f.ops);
 f.command(f.manager,'approval:decide',approval(f),{decision:'approved',reason:'Independent review before account deactivation'});
 const secondManager=addUser(f.store,{tenantId:f.manager.tenantId,username:'reviewer-admin@illustrative.invalid',name:'Illustrative second carrier manager',role:'carrier',password});
 f.command(secondManager,'user:deactivate',f.manager,{reason:'Reviewer no longer has carrier employment authority'});
 assert.equal(runWorkflowTick(f.ops),1);
 assert.equal(workflow(f).status,'failed');assert.equal(workflow(f).lastError,'APPROVAL_AUTHORITY');assert.equal(approval(f).status,'stale');
 assert.equal(fresh(f,'exception',exception.id).status,'open');
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='approval:apply' AND resource_id=?").get(approval(f).id).n,0);
});
