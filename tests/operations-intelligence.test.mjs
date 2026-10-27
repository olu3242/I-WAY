import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createIntelligenceExtensions,intelligenceState,intelligenceIntegritySQL} from '../domain/operations-intelligence.mjs';
const run=promisify(execFile),code=value=>error=>error.code===value;
function install(f){Object.assign(f.ops.extensions,createIntelligenceExtensions());f.ops.views.push(intelligenceState);f.store.db.exec(intelligenceIntegritySQL);return f}
function validated(f){const load=f.createLoad();return f.command(f.dispatcher,'load:validate',load)}
const routeInput={distanceMiles:180,averageMph:60,handlingMinutes:30,departureAt:'2026-11-02T14:00:00.000Z',source:'user_estimate'};
function recommendation(f,load=validated(f)){return f.command(f.dispatcher,'capacity:recommend',load)}
function approve(f,proposal){return f.command(f.manager,'capacity:decide',proposal,{decision:'approved',reason:'Independent carrier review of current eligibility'})}
function setGrants(f,actor,grants){const current=f.store.principal(actor.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...current,permissions:grants}),actor.id)}
test('B32 real deterministic ETA exposes input basis, constraints and traceable duration without claiming live routing',async t=>{
 const f=install(await fixture(t)),load=validated(f),route=f.command(f.dispatcher,'route:evaluate',load,routeInput);
 assert.equal(route.durationMinutes,210);assert.equal(route.estimatedArrivalAt,'2026-11-02T17:30:00.000Z');assert.equal(route.onTimeEstimate,true);
 assert.equal(route.source,'user_estimate');assert.equal(route.model,null);assert.equal(route.provider,'none');assert.equal(route.confidence,'low');
 const late=f.command(f.dispatcher,'route:evaluate',load,{...routeInput,distanceMiles:1800,averageMph:30});
 assert.ok(late.constraints.includes('ESTIMATED_LATE_DELIVERY'));
 const early=f.command(f.dispatcher,'route:evaluate',load,{...routeInput,departureAt:'2026-11-02T13:00:00.000Z',source:'local_fixture'});
 assert.ok(early.constraints.includes('DEPARTURE_BEFORE_PICKUP_WINDOW'));
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).version,load.version);
 assert.throws(()=>f.store.update('routeevaluation',route.id,f.manager.tenantId,route.version,{estimatedArrivalAt:'2099-01-01T00:00:00.000Z'}),/immutable/);
});
test('B32 rejects nonfinite, forged, unbounded and unauthorized route inputs',async t=>{
 const f=install(await fixture(t)),load=validated(f);
 for(const patch of [{distanceMiles:NaN},{distanceMiles:Infinity},{distanceMiles:-1},{distanceMiles:20001},{averageMph:0},{averageMph:86},{handlingMinutes:1441},{departureAt:'invalid'},{source:'live_gps'},{latitude:41.1}]){
  assert.throws(()=>f.command(f.dispatcher,'route:evaluate',load,{...routeInput,...patch}));
 }
 assert.throws(()=>f.command(f.otherDispatcher,'route:evaluate',load,routeInput),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.outsider,'route:evaluate',load,routeInput),code('NOT_FOUND'));
 assert.throws(()=>f.command(f.driver,'route:evaluate',load,routeInput),code('HUMAN_REQUIRED'));
 assert.equal(f.store.list('routeevaluation',f.manager.tenantId).length,0);
});
test('B33 risk priorities derive from persisted milestones, estimates, eligibility and exceptions without altering shipment',async t=>{
 const f=install(await fixture(t,{now:()=>new Date('2026-11-04T16:00:00.000Z')})),load=f.assign();
 f.command(f.dispatcher,'route:evaluate',load,{...routeInput,distanceMiles:1800,averageMph:30});
 const vehicle=f.store.get('vehicle',f.vehicle.id,f.manager.tenantId);
 f.command(f.manager,'vehicle:update',vehicle,{maintenance:'out_of_service',reason:'Illustrative verified maintenance issue'});
 f.store.insert('documentexception',f.manager.tenantId,{loadId:load.id,status:'open',issueCodes:['MISSING_BOL']});
 const risk=f.command(f.dispatcher,'risk:analyze',load);
 assert.equal(risk.score,100);assert.equal(risk.escalation,'carrier');assert.equal(risk.status,'advisory');
 assert.ok(risk.rules.some(rule=>rule.code==='MISSED_MILESTONE'));assert.ok(risk.rules.some(rule=>rule.code==='ESTIMATED_DELAY'));
 assert.ok(risk.rules.some(rule=>rule.code==='CAPACITY_INELIGIBLE'));assert.ok(risk.rules.some(rule=>rule.code==='OPEN_DOCUMENT_EXCEPTION'));
 assert.equal(risk.model,null);assert.equal(f.store.get('load',load.id,f.manager.tenantId).version,load.version);
 assert.equal(f.store.list('assignment',f.manager.tenantId).length,1);
});
test('B34 independent human approval applies exactly the eligible proposal with audit and immutable evidence',async t=>{
 const f=install(await fixture(t)),load=validated(f),proposal=recommendation(f,load);
 assert.equal(proposal.status,'pending');assert.equal(proposal.driverId,f.driver.id);assert.equal(proposal.vehicleId,f.vehicle.id);
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).driverId,null);assert.equal(proposal.model,null);
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',proposal,{reason:'No human approval yet'}),code('CAPACITY_STATE'));
 const approved=approve(f,proposal),key='capacity-apply-exact-replay';
 const applied=f.command(f.dispatcher,'capacity:apply',approved,{reason:'Apply reviewed capacity'},key);
 assert.equal(applied.status,'applied');
 const assigned=f.store.get('load',load.id,f.manager.tenantId);assert.equal(assigned.driverId,proposal.driverId);assert.equal(assigned.status,'assigned');
 assert.deepEqual(f.command(f.dispatcher,'capacity:apply',approved,{reason:'Apply reviewed capacity'},key),applied);
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',applied,{reason:'Attempt second application'}),code('CAPACITY_STATE'));
 assert.equal(f.store.list('assignment',f.manager.tenantId).length,1);
 const actions=f.store.db.prepare('SELECT action FROM audit WHERE resource_id=? AND outcome=?').all(proposal.id,'success').map(row=>row.action);
 assert.deepEqual(actions,['capacity:recommend','capacity:decide','capacity:apply']);
 assert.throws(()=>f.store.update('capacityproposal',applied.id,f.manager.tenantId,applied.version,{vehicleId:'substitution'}),/immutable/);
});
test('B34 rejects self-approval, expired, superseded, rejected and stale evidence',async t=>{
 let now=new Date('2026-10-11T12:00:00.000Z');const f=install(await fixture(t,{now:()=>now})),load=validated(f);
 const own=f.command(f.manager,'capacity:recommend',load);
 assert.throws(()=>f.command(f.manager,'capacity:decide',own,{decision:'approved',reason:'Self approval forbidden'}),code('SEPARATION'));
 const proposal=recommendation(f,load);assert.equal(f.store.get('capacityproposal',own.id,f.manager.tenantId).status,'superseded');
 now=new Date(now.getTime()+31*60000);
 assert.throws(()=>approve(f,proposal),code('CAPACITY_EXPIRED'));
 const rejected=f.command(f.manager,'capacity:decide',recommendation(f,load),{decision:'rejected',reason:'Choose another operational approach'});
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',rejected,{reason:'Cannot apply rejected proposal'}),code('CAPACITY_STATE'));
 const stale=recommendation(f,load),driver=f.store.get('driver',f.driver.id,f.manager.tenantId);
 f.command(f.manager,'driver:update',driver,{available:false,reason:'Driver availability changed'});
 assert.throws(()=>approve(f,stale),code('CAPACITY_STALE'));
 assert.equal(f.store.get('load',load.id,f.manager.tenantId).driverId,null);
});
test('B34 rechecks approver authority and load state at application and rejects autonomous substitution',async t=>{
 const f=install(await fixture(t)),load=validated(f),approved=approve(f,recommendation(f,load));
 const original=f.store.principal(f.manager.id).permissions;
 setGrants(f,f.manager,original.filter(permission=>permission!=='capacity:approve'));
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',approved,{reason:'Approval authority was withdrawn'}),code('APPROVAL_AUTHORITY'));
 setGrants(f,f.manager,original);
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',approved,{reason:'Forged candidate',driverId:f.driver.id}),code('FIELDS'));
 const automation={id:'service',role:'automation',tenantId:f.manager.tenantId,active:true,permissions:['capacity:apply','load:dispatch']};
 assert.throws(()=>f.ops.extensions['capacity:apply'](f.ops,automation,{resourceId:approved.id,expectedVersion:approved.version,payload:{reason:'Forbidden autonomous action'}}),code('HUMAN_REQUIRED'));
 f.command(f.dispatcher,'load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Separate authorized manual assignment'});
 assert.throws(()=>f.command(f.dispatcher,'capacity:apply',approved,{reason:'Old load snapshot'}),code('CAPACITY_STALE'));
 assert.equal(f.store.list('assignment',f.manager.tenantId).length,1);
});
test('B34 no eligible pair remains advisory and cannot be approved',async t=>{
 const f=install(await fixture(t)),load=validated(f),driver=f.store.get('driver',f.driver.id,f.manager.tenantId);
 f.command(f.manager,'driver:update',driver,{compliance:'critical',reason:'Illustrative critical compliance evidence'});
 const proposal=recommendation(f,load);assert.equal(proposal.status,'no_match');assert.equal(proposal.driverId,null);assert.equal(proposal.eligiblePairCount,0);
 assert.throws(()=>approve(f,proposal),code('CAPACITY_STATE'));assert.equal(f.store.get('load',load.id,f.manager.tenantId).driverId,null);
});
test('B31 tower is scoped to assigned shipments and current persona permissions',async t=>{
 const f=install(await fixture(t)),mine=validated(f);let other=f.createLoad();other=f.store.update('load',other.id,f.manager.tenantId,other.version,{dispatcherId:f.otherDispatcher.id});
 f.store.insert('documentexception',f.manager.tenantId,{loadId:mine.id,status:'open',issueCodes:['MISSING_BOL']});
 f.store.insert('documentexception',f.manager.tenantId,{loadId:other.id,status:'open',issueCodes:['MISSING_POD']});
 f.command(f.dispatcher,'route:evaluate',mine,routeInput);recommendation(f,mine);
 const state=f.ops.state(f.dispatcher.id);assert.equal(state.controlTower.shipmentCount,1);assert.equal(state.controlTower.openExceptionCount,1);
 assert.ok(state.controlTower.actions.every(action=>action.loadId===mine.id));assert.equal(state.routes.length,1);assert.equal(state.costSummary,null);
 assert.equal(f.ops.state(f.driver.id).controlTower,null);assert.equal(f.ops.state(f.outsider.id).controlTower.shipmentCount,0);
 setGrants(f,f.dispatcher,f.dispatcher.permissions.filter(permission=>permission!=='intelligence:view'));
 assert.equal(f.ops.state(f.dispatcher.id).controlTower,null);
});
test('B39 recorded costs remain separate from estimates, reject duplicate evidence and never invent savings',async t=>{
 const f=install(await fixture(t)),load=validated(f);
 f.command(f.dispatcher,'route:evaluate',load,routeInput);
 const recorded=f.command(f.manager,'cost:record',load,{category:'fuel',amountCents:12000,basis:'recorded',reference:'ILL-FUEL-RECEIPT-1'});
 f.command(f.manager,'cost:record',load,{category:'exception',amountCents:3000,basis:'recorded',reference:'ILL-EXCEPTION-1'});
 f.command(f.manager,'cost:record',load,{category:'labor',amountCents:8000,basis:'estimate',reference:'ILL-LABOR-ESTIMATE-1'});
 f.createLoad();
 const view=f.ops.state(f.manager.id).costSummary;assert.equal(view.recordedCents,15000);assert.equal(view.estimatedCents,8000);
 assert.equal(view.recordedCostPerLoadCents,15000);assert.equal(view.loadsWithoutRecordedCosts,1);assert.equal(view.savingsCents,null);assert.equal(view.routeEfficiency,null);
 const perLoad=view.perLoad.find(row=>row.loadId===load.id);assert.equal(perLoad.costPerEstimatedMileCents,83);assert.equal(perLoad.exceptionRecordedCents,3000);
 assert.throws(()=>f.command(f.manager,'cost:record',load,{category:'other',amountCents:1,basis:'recorded',reference:'ILL-FUEL-RECEIPT-1'}),code('COST_DUPLICATE'));
 assert.throws(()=>f.command(f.dispatcher,'cost:record',load,{category:'fuel',amountCents:1,basis:'recorded',reference:'ILL-DENIED'}),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.manager,'cost:record',load,{category:'fuel',amountCents:1.5,basis:'recorded',reference:'ILL-FRACTION'}),code('NUMBER'));
 assert.throws(()=>f.store.update('operationcost',recorded.id,f.manager.tenantId,recorded.version,{amountCents:0}),/immutable/);
 assert.equal(recorded.externalTransaction,false);
});
test('B34 independent-process application concurrency admits one assignment and survives connection restart',async t=>{
 const f=install(await fixture(t)),load=validated(f),proposal=approve(f,recommendation(f,load));
 const script="import {OperationsStore} from './server/operations-store.mjs';import {Operations} from './domain/operations.mjs';import {createIntelligenceExtensions} from './domain/operations-intelligence.mjs';const [path,actor,payload]=process.argv.slice(1);const store=new OperationsStore(path);try{const ops=new Operations(store,{extensions:createIntelligenceExtensions()});try{const result=ops.execute(actor,JSON.parse(payload));process.stdout.write(JSON.stringify({ok:true,status:result.status}));}catch(e){process.stdout.write(JSON.stringify({ok:false,code:e.code}));}}finally{store.close()}";
 const attempts=await Promise.all([0,1].map(async()=>{const command={action:'capacity:apply',resourceId:proposal.id,expectedVersion:proposal.version,payload:{reason:'Concurrent approved application'},idempotencyKey:randomUUID()};const result=await run(process.execPath,['--input-type=module','-e',script,f.path,f.dispatcher.id,JSON.stringify(command)],{cwd:process.cwd()});return JSON.parse(result.stdout)}));
 assert.equal(attempts.filter(result=>result.ok).length,1);assert.ok(attempts.some(result=>result.code==='STALE'));
 const reopened=new OperationsStore(f.path);
 try{assert.equal(reopened.get('capacityproposal',proposal.id,f.manager.tenantId).status,'applied');assert.equal(reopened.list('assignment',f.manager.tenantId).filter(item=>item.status==='active').length,1);assert.equal(reopened.get('load',load.id,f.manager.tenantId).driverId,proposal.driverId)}finally{reopened.close()}
});

test('B31/B39 cached intelligence and cost responses obey current permissions rather than past access',async t=>{
 const f=install(await fixture(t)),load=validated(f),routeKey='route-replay-current-policy',costKey='cost-replay-current-policy';
 f.command(f.dispatcher,'route:evaluate',load,routeInput,routeKey);
 f.command(f.manager,'cost:record',load,{category:'fuel',amountCents:900,basis:'recorded',reference:'ILL-CURRENT-AUTH'},costKey);
 setGrants(f,f.dispatcher,f.dispatcher.permissions.filter(permission=>permission!=='intelligence:view'));
 assert.throws(()=>f.command(f.dispatcher,'route:evaluate',load,routeInput,routeKey),code('FORBIDDEN'));
 setGrants(f,f.manager,f.manager.permissions.filter(permission=>permission!=='cost:manage'));
 assert.throws(()=>f.command(f.manager,'cost:record',load,{category:'fuel',amountCents:900,basis:'recorded',reference:'ILL-CURRENT-AUTH'},costKey),code('FORBIDDEN'));
 assert.equal(f.store.list('routeevaluation',f.manager.tenantId).length,1);assert.equal(f.store.list('operationcost',f.manager.tenantId).length,1);
});

test('workspace audit exposes metadata only, including after domain permission withdrawal',async t=>{
 const f=install(await fixture(t)),load=validated(f);
 const cost=f.command(f.manager,'cost:record',load,{category:'fuel',amountCents:91743,basis:'recorded',reference:'ILL-AUDIT-COST'});
 f.command(f.dispatcher,'route:evaluate',load,routeInput);
 setGrants(f,f.manager,f.manager.permissions.filter(permission=>permission!=='cost:manage'));
 setGrants(f,f.dispatcher,f.dispatcher.permissions.filter(permission=>permission!=='intelligence:view'));
 // An allowed UUID can contain the same digits as a private amount. Compare
 // typed metadata fields, rather than searching all serialized identifiers.
 const metadataId='00091743-1111-4111-8111-111111111111';
 f.store.audit(f.manager,'cost:record',metadataId,'success',{after:{amountCents:91743,reference:'ILL-AUDIT-PRIVATE-PAYLOAD'}});
 const managerState=f.ops.state(f.manager.id),dispatcherState=f.ops.state(f.dispatcher.id);
 assert.equal(managerState.costSummary,null);assert.deepEqual(dispatcherState.routes,[]);
 for(const state of [managerState,dispatcherState]){
  assert.ok(state.audit.length>0);
  for(const row of state.audit){
   assert.deepEqual(Object.keys(row).sort(),['sequence','actorId','action','resourceId','at','outcome'].sort());
   const stored=f.store.db.prepare('SELECT sequence,actor_id AS actorId,action,resource_id AS resourceId,at,outcome FROM audit WHERE sequence=?').get(row.sequence);
   assert.deepEqual({...row},{...stored});
  }
  assert.ok(!JSON.stringify(state.audit).includes('ILL-AUDIT-PRIVATE-PAYLOAD'));
 }
 assert.ok(managerState.audit.some(row=>row.resourceId===metadataId));
 const stored=JSON.parse(f.store.db.prepare('SELECT detail FROM audit WHERE resource_id=?').get(cost.id).detail);
 assert.equal(stored.after.amountCents,91743);
 assert.throws(()=>f.store.db.prepare('DELETE FROM audit WHERE resource_id=?').run(cost.id),/append.only|immutable/i);
});
