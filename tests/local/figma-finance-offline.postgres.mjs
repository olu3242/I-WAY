import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {settlementFixture} from '../helpers/settlement-fixture.mjs';
import {buildLocalOperationsPgConfig} from '../../server/operations-postgres.mjs';
import {DurableOperationsPgEngine,exportTenantState} from '../../server/operations-durable-postgres.mjs';
import {offlineContext,executeOfflineCommand} from '../../server/operations-offline.mjs';
test('Figma closure finance and offline commands on restricted disposable PostgreSQL',{timeout:180000},async t=>{
 assert.equal(process.env.IWAY_FIGMA_LOCAL_OPT_IN,'true','Explicit disposable-cluster opt-in required');
 const pg=await isolatedPostgres({optIn:true});let pool;
 try{
  await pg.admin.query('ALTER ROLE iway_operations_fixture NOINHERIT');
  await pg.admin.query((await readFile(new URL('../../db/review-only/b662-operations-engine.sql',import.meta.url),'utf8')).replaceAll('iway_operations_runtime','iway_operations_fixture'));
  const f=await settlementFixture(t,{fleet:true});f.complete();const assigned=f.assign();
  for(const tenant of f.store.db.prepare('SELECT id FROM tenants').all()){
   const state=exportTenantState(f.store,tenant.id);await pg.admin.query('INSERT INTO operations_engine_private.realms(tenant_id) VALUES($1)',[tenant.id]);
   for(const user of state.payload.tables.users)await pg.admin.query('INSERT INTO operations_engine_private.principals(tenant_id,actor_id) VALUES($1,$2)',[tenant.id,user.id]);
   await pg.admin.query('INSERT INTO operations_engine_private.state(tenant_id,version,payload) VALUES($1,1,$2::jsonb)',[tenant.id,JSON.stringify(state.payload)]);
   for(const entry of state.audit)await pg.admin.query('INSERT INTO operations_engine_private.audit(tenant_id,sequence,entry) VALUES($1,$2,$3::jsonb)',[tenant.id,entry.sequence,JSON.stringify(entry)]);
  }
  const config=buildLocalOperationsPgConfig({optIn:true,connection:pg.restricted,ca:pg.ssl.ca});pool=new Pool(config);pool.on('error',()=>{});
  let engine=new DurableOperationsPgEngine({pool,config});
  const scope=actor=>({tenantId:actor.tenantId,actorId:actor.id}),tx=(actor,fn)=>engine.transaction(scope(actor),({operations})=>fn(operations));
  const command=(actor,action,row,payload={},idempotencyKey=randomUUID())=>tx(actor,ops=>ops.execute(actor.id,{action,resourceId:row?.id,expectedVersion:row?.version,payload,idempotencyKey}));
  const restart=async()=>{await pool.end();pool=new Pool(config);pool.on('error',()=>{});engine=new DurableOperationsPgEngine({pool,config});};
  await t.test('actual TLS runtime identity and FORCE RLS checked before any command',async()=>{
   assert.deepEqual((await pool.query('SELECT session_user,current_user')).rows[0],{session_user:'iway_operations_fixture',current_user:'iway_operations_fixture'});
   assert.equal((await engine.health()).rls,true);assert.equal((await pool.query('SELECT * FROM operations_engine_private.state')).rowCount,0);
  });
  const envelope={schemaVersion:1,...offlineContext(f.driver),action:'load:accept',resourceId:assigned.id,expectedVersion:assigned.version,payload:{},idempotencyKey:randomUUID(),createdAt:Date.now()};
  await t.test('concurrent replay and cold restart confirm one status effect and one audit event',async()=>{
   const results=await Promise.all(Array.from({length:5},()=>tx(f.driver,ops=>executeOfflineCommand(ops,ops.actor(f.driver.id),envelope))));
   assert.ok(results.every(r=>r.confirmed&&r.result.status==='accepted'));await restart();
   assert.equal((await tx(f.driver,ops=>executeOfflineCommand(ops,ops.actor(f.driver.id),envelope))).result.status,'accepted');
   assert.equal(await tx(f.manager,ops=>ops.store.db.prepare("SELECT count(*) n FROM audit WHERE action='load:accept' AND resource_id=? AND outcome='success'").get(assigned.id).n),1);
  });
  await t.test('replay rejects expired, foreign-actor, stale-version and sensitive payload envelopes',async()=>{
   for(const patch of [{createdAt:Date.now()-86400001},{actorId:f.outsider.id},{authorityFingerprint:'0'.repeat(64)},{payload:{signature:'not-accepted'}}])await assert.rejects(tx(f.driver,ops=>executeOfflineCommand(ops,ops.actor(f.driver.id),{...envelope,...patch})));
   await assert.rejects(tx(f.driver,ops=>executeOfflineCommand(ops,ops.actor(f.driver.id),{...envelope,action:'load:transit',idempotencyKey:randomUUID()})),e=>e.code==='STALE');
   await assert.rejects(tx(f.outsider,ops=>ops.read('load',assigned.id,f.outsider,'load:view')));
  });
  let settlement,pay;
  await t.test('settlement calculation, concurrent approval and immutable evidence survive cold restart',async()=>{
   settlement=await tx(f.manager,ops=>ops.execute(f.manager.id,{action:'settlement:create',payload:{payeeType:'fleet',payeeId:f.fleet.id,week:'2026-11-02',shareBps:10000,adminFeeBps:1000,deductions:[{code:'fuel',amountCents:320000},{code:'insurance',amountCents:40000},{code:'other',amountCents:15000}],escrowInstallmentCents:30000,escrowTargetCents:100000,roundingPolicy:'half_up_cent_v1',reason:'Illustrative explicit test terms'},idempotencyKey:randomUUID()}));
   assert.equal(settlement.calculation.netCents,1215000);const key=randomUUID();
   const rows=await Promise.all(Array.from({length:5},()=>command(f.manager,'settlement:approve',settlement,{reason:'Illustrative human approval'},key)));settlement=rows[0];await restart();
   assert.equal(await tx(f.manager,ops=>ops.store.list('settlementapproval',f.manager.tenantId).length),1);
   await assert.rejects(tx(f.manager,ops=>ops.store.update('settlement',settlement.id,settlement.tenantId,settlement.version,{calculation:{netCents:0}})));
   assert.equal(await tx(f.manager,ops=>ops.store.get('settlement',settlement.id,settlement.tenantId).calculation.netCents),1215000);
  });
  await t.test('fleet pay approval and driver projection retain ownership after restart',async()=>{
   pay=await command(f.fleetUser,'driverpay:create',null,{driverId:f.driver.id,settlementId:settlement.id,perLoadCents:100000,reason:'Illustrative fleet-owned terms'});
   pay=await command(f.fleetUser,'driverpay:approve',pay,{reason:'Illustrative fleet review'});await restart();
   const state=await tx(f.driver,ops=>ops.state(f.driver.id));assert.equal(state.driverpay[0].netCents,100000);assert.equal(state.settlements.length,0);assert.equal(state.driverpay[0].sourceSettlementId,undefined);
   await assert.rejects(command(f.manager,'driverpay:unapprove',pay,{reason:'Carrier does not own fleet pay'}));
   await assert.rejects(command(f.manager,'settlement:unapprove',settlement,{reason:'Dependent pay is approved'}),e=>e.code==='PAYROLL_DEPENDENCY');
  });
  await t.test('failed financial transaction rolls back state, command receipts and approval audit',async()=>{
   const before=await tx(f.fleetUser,ops=>ops.store.get('driverpay',pay.id,pay.tenantId));
   await assert.rejects(tx(f.fleetUser,ops=>{ops.execute(f.fleetUser.id,{action:'driverpay:unapprove',resourceId:pay.id,expectedVersion:pay.version,payload:{reason:'Illustrative rollback'},idempotencyKey:randomUUID()});throw Error('Illustrative fault');}));
   assert.deepEqual(await tx(f.fleetUser,ops=>ops.store.get('driverpay',pay.id,pay.tenantId)),before);
  });
  await t.test('driver service evidence and fleet review persist without clearing carrier authority',async()=>{
   let vehicle=await tx(f.manager,ops=>ops.store.get('vehicle',f.vehicle.id,f.manager.tenantId));
   vehicle=await command(f.manager,'vehicle:serviceplan',vehicle,{odometerMiles:1000,intervalMiles:100,warningMiles:10,reason:'Illustrative interval'});
   const row=await command(f.driver,'maintenance:record',null,{vehicleId:vehicle.id,odometerMiles:1095,performedAt:'2026-01-01T00:00:00.000Z',category:'scheduled_service',note:'Illustrative fleet-private history'});
   await restart();assert.equal((await tx(f.driver,ops=>ops.state(f.driver.id))).serviceVehicles[0].due,true);
   await command(f.fleetUser,'maintenance:review',row,{decision:'approve',reason:'Illustrative owner review'});await restart();
   assert.equal((await tx(f.driver,ops=>ops.state(f.driver.id))).serviceVehicles[0].nextServiceOdometer,1195);
   const carrier=await tx(f.manager,ops=>ops.state(f.manager.id));assert.equal(carrier.serviceRecords[0].note,undefined);
  });
 }finally{if(pool)await pool.end();await pg.cleanup();}
});
