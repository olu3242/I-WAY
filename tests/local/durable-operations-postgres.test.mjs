// Real disposable PostgreSQL certification. No environment files or hosted connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {fixture} from '../helpers/operations-fixture.mjs';
import {runAgenticDurabilityScenarios} from '../helpers/b665-agentic-scenarios.mjs';
import {createOperationsFeatures} from '../../domain/operations-features.mjs';
import {buildLocalOperationsPgConfig} from '../../server/operations-postgres.mjs';
import {DurableOperationsPgEngine,exportTenantState} from '../../server/operations-durable-postgres.mjs';

test('B662-B676 durable domain engine on restricted disposable PostgreSQL',{timeout:240000},async t=>{
 assert.equal(process.env.IWAY_DURABLE_LOCAL_OPT_IN,'true','Explicit disposable-cluster opt-in required');
 const pg=await isolatedPostgres({optIn:true});let pool;
 try{
  await pg.admin.query('ALTER ROLE iway_operations_fixture NOINHERIT');
  const migration=(await readFile(new URL('../../db/review-only/b662-operations-engine.sql',import.meta.url),'utf8')).replaceAll('iway_operations_runtime','iway_operations_fixture');
  await pg.admin.query(migration);await pg.admin.query(migration);
  const now=()=>new Date('2026-11-02T14:00:00.000Z');
  const native=await fixture(t,{...createOperationsFeatures(),now}),assigned=native.assign();
  for(const tenant of native.store.db.prepare('SELECT id FROM tenants').all()){
   const state=exportTenantState(native.store,tenant.id);
   await pg.admin.query('INSERT INTO operations_engine_private.realms(tenant_id) VALUES($1)',[tenant.id]);
   for(const user of state.payload.tables.users)await pg.admin.query('INSERT INTO operations_engine_private.principals(tenant_id,actor_id,active) VALUES($1,$2,$3)',[tenant.id,user.id,JSON.parse(user.data).active]);
   await pg.admin.query('INSERT INTO operations_engine_private.state(tenant_id,version,payload) VALUES($1,1,$2::jsonb)',[tenant.id,JSON.stringify(state.payload)]);
   for(const entry of state.audit)await pg.admin.query('INSERT INTO operations_engine_private.audit(tenant_id,sequence,entry) VALUES($1,$2,$3::jsonb)',[tenant.id,entry.sequence,JSON.stringify(entry)]);
  }
  const config=buildLocalOperationsPgConfig({optIn:true,connection:pg.restricted,ca:pg.ssl.ca});
  pool=new Pool(config);pool.on('error',()=>{});
  let engine=new DurableOperationsPgEngine({pool,config,operationsOptions:{now}});
  const restart=async()=>{await pool.end();pool=new Pool(config);pool.on('error',()=>{});engine=new DurableOperationsPgEngine({pool,config,operationsOptions:{now}});};
  const scope=actor=>({tenantId:actor.tenantId,actorId:actor.id}),a=scope(native.manager),b=scope(native.outsider);
  const transact=(s,fn)=>engine.transaction(s,({operations})=>fn(operations));
  const command=(actor,action,resource,payload={},key=randomUUID())=>transact(scope(actor),ops=>ops.execute(actor.id,{action,resourceId:resource?.id,expectedVersion:resource?.version,payload,idempotencyKey:key}));
  const raw=async(s,fn)=>{const client=await pool.connect();try{await client.query('BEGIN');if(s)await client.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true)",[s.tenantId,s.actorId]);return await fn(client);}finally{await client.query('ROLLBACK');client.release();}};
  const persisted=async()=>{const row=(await pg.admin.query('SELECT version,payload FROM operations_engine_private.state WHERE tenant_id=$1',[a.tenantId])).rows[0];return {version:row.version,payload:row.payload,audit:(await pg.admin.query('SELECT sequence,entry FROM operations_engine_private.audit WHERE tenant_id=$1 ORDER BY sequence',[a.tenantId])).rows};};
  await t.test('actual restricted TLS login, idempotent schema and FORCE RLS',async()=>{
   assert.deepEqual((await pool.query('SELECT session_user,current_user')).rows[0],{session_user:'iway_operations_fixture',current_user:'iway_operations_fixture'});
   assert.deepEqual(await engine.health(),{storage:'postgresql',identityVerified:true,restrictedRole:true,rls:true,scope:'tenant'});
   const tables=(await pg.admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_engine_private' AND c.relkind='r'")).rows;
   assert.equal(tables.length,5);assert.ok(tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity));
  });
  await t.test('RLS denies absent context, forged actor, cross-tenant reads and writes',async()=>{
   for(const s of [null,{tenantId:a.tenantId,actorId:b.actorId}])await raw(s,async client=>{
    for(const table of ['state','audit','principals'])assert.equal((await client.query('SELECT * FROM operations_engine_private.'+table)).rowCount,0);
   });
   await raw(b,async client=>{
    assert.equal((await client.query('SELECT * FROM operations_engine_private.state WHERE tenant_id=$1',[a.tenantId])).rowCount,0);
    assert.equal((await client.query('UPDATE operations_engine_private.state SET version=version+1 WHERE tenant_id=$1',[a.tenantId])).rowCount,0);
   });
   await assert.rejects(engine.transaction({...a,actorId:b.actorId},()=>true),error=>error.code==='AUTHORIZATION');
   await assert.rejects(engine.transaction({tenantId:a.tenantId,actorId:'invalid'},()=>true),error=>error.code==='CONTEXT');
  });
  await t.test('inactive directory principal and realm fail closed without state leakage',async()=>{
   for(const table of ['principals','realms']){
    const filter=table==='principals'?'tenant_id=$1 AND actor_id=$2':'tenant_id=$1',values=table==='principals'?[a.tenantId,a.actorId]:[a.tenantId];
    await pg.admin.query('UPDATE operations_engine_private.'+table+' SET active=false WHERE '+filter,values);
    try{
     await assert.rejects(engine.transaction(a,()=>true),error=>error.code==='AUTHORIZATION');
     await raw(a,async client=>assert.equal((await client.query('SELECT * FROM operations_engine_private.state')).rowCount,0));
    }finally{await pg.admin.query('UPDATE operations_engine_private.'+table+' SET active=true WHERE '+filter,values);}
   }
  });
  await runAgenticDurabilityScenarios(t,{transact,restart,fixture:{...native,load:assigned}});
  await t.test('complete shipment and financial command lifecycle persists across engine restarts',async()=>{
   let load=await transact(a,ops=>ops.store.get('load',assigned.id,a.tenantId));
   load=await command(native.driver,'load:accept',load);await restart();
   load=await command(native.driver,'load:pickup',load,{stopId:load.stops[0].id});
   load=await command(native.driver,'load:transit',load);await restart();
   load=await command(native.driver,'load:deliver',load,{stopId:load.stops[1].id,proofReference:'Illustrative B676 durable delivery evidence'});await restart();
   assert.equal(load.status,'delivered');
   const invoice=await command(native.manager,'finance:prepare',load);await restart();
   const approved=await command(native.manager,'finance:approve',invoice,{reason:'Illustrative commercial review after durable restart'});
   assert.equal(approved.status,'approved');
   assert.equal(await transact(a,ops=>ops.store.list('assignment',a.tenantId).filter(item=>item.loadId===load.id&&item.status==='active').length),0);
  });
  const newCommand=()=>({action:'load:create',idempotencyKey:randomUUID(),payload:{reference:'ILL-B676-'+randomUUID().slice(0,6),customer:'Illustrative customer',dispatcherId:native.dispatcher.id,commodity:'Illustrative freight',weightLb:1000,stops:[{type:'pickup',location:'Illustrative Austin',at:'2026-11-02T14:00:00.000Z'},{type:'delivery',location:'Illustrative Dallas',at:'2026-11-03T14:00:00.000Z'}],rateCents:10000,charges:[],factored:false}});
  await t.test('concurrent replay commits one load and shipment with their two audit records and one idempotency result',async()=>{
   const c=newCommand();const before=await persisted();
   const results=await Promise.all(Array.from({length:8},()=>transact(a,ops=>ops.execute(native.manager.id,c))));
   assert.ok(results.every(result=>result.id===results[0].id));await restart();
   assert.deepEqual(await transact(a,ops=>ops.execute(native.manager.id,c)),results[0]);
   await transact(a,ops=>{
    assert.equal(ops.store.list('load',a.tenantId).filter(item=>item.id===results[0].id).length,1);
    assert.equal(ops.store.list('shipment',a.tenantId).filter(item=>item.loadId===results[0].id).length,1);
    assert.equal(ops.store.db.prepare('SELECT count(*) AS n FROM commands WHERE tenant_id=? AND actor_id=? AND key=?').get(a.tenantId,a.actorId,c.idempotencyKey).n,1);
   });
   const added=(await persisted()).audit.slice(before.audit.length);
   assert.deepEqual(added.map(row=>row.entry.action),['load:create','shipment:create']);
   await assert.rejects(transact(a,ops=>ops.execute(native.manager.id,{...c,payload:{...c.payload,reference:'Conflicting illustrative input'}})),error=>error.code==='IDEMPOTENCY'&&error.status===409);
  });
  await t.test('conflicting dispatch commands have one winner and maintain assignment uniqueness',async()=>{
   const c=newCommand(),created=await transact(a,ops=>ops.execute(native.manager.id,c));
   const validated=await command(native.dispatcher,'load:validate',created);
   const decisions=await Promise.allSettled([0,1].map(()=>command(native.dispatcher,'load:assign',validated,{driverId:native.driver.id,vehicleId:native.vehicle.id,reason:'Illustrative concurrent dispatch'})));
   assert.equal(decisions.filter(item=>item.status==='fulfilled').length,1);
   assert.equal(decisions.find(item=>item.status==='rejected').reason.code,'STALE');await restart();
   assert.equal(await transact(a,ops=>ops.store.list('assignment',a.tenantId).filter(item=>item.loadId===created.id&&item.status==='active').length),1);
  });
  await t.test('callback failure rolls back resources, commands and audit and permits safe retry',async()=>{
   const c=newCommand(),before=await persisted();
   await assert.rejects(engine.transaction(a,({operations})=>{operations.execute(native.manager.id,c);throw new Error('B676 sanitized fixture failure');}),error=>error.code==='UNAVAILABLE');
   assert.deepEqual(await persisted(),before);await restart();
   const result=await transact(a,ops=>ops.execute(native.manager.id,c));assert.equal(result.status,'draft');
   assert.equal((await persisted()).audit.length,before.audit.length+2);
  });
  await t.test('database transaction persistence failure rolls back then recovers',async()=>{
   const c=newCommand(),before=await persisted();
   await pg.admin.query("CREATE FUNCTION operations_engine_private.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='synthetic unavailable'; END $$");
   await pg.admin.query('CREATE TRIGGER fixture_fail BEFORE UPDATE ON operations_engine_private.state FOR EACH ROW EXECUTE FUNCTION operations_engine_private.fixture_fail()');
   try{await assert.rejects(transact(a,ops=>ops.execute(native.manager.id,c)),error=>error.code==='UNAVAILABLE');assert.deepEqual(await persisted(),before);}finally{
    await pg.admin.query('DROP TRIGGER fixture_fail ON operations_engine_private.state');await pg.admin.query('DROP FUNCTION operations_engine_private.fixture_fail()');
   }
   await restart();assert.equal((await transact(a,ops=>ops.execute(native.manager.id,c))).status,'draft');
  });
  await t.test('audit mutation and runtime role escalation are denied',async()=>{
   for(const sql of ['UPDATE operations_engine_private.audit SET entry=entry','DELETE FROM operations_engine_private.audit','TRUNCATE operations_engine_private.audit','CREATE ROLE b676_forbidden','SET ROLE iway_fixture_admin'])await raw(a,client=>assert.rejects(client.query(sql),error=>error.code==='42501'));
   await raw(a,client=>assert.rejects(client.query('UPDATE operations_engine_private.principals SET active=false'),error=>error.code==='42501'));
   await raw(a,async client=>assert.equal((await client.query('SELECT * FROM operations_engine_private.deployment_configuration')).rowCount,0));
  });
  await t.test('connection termination rejects an interrupted transaction and new pool recovers tenant safely',async()=>{
   const c=newCommand(),before=await persisted();let entered,release;
   const waiting=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
   const transaction=engine.transaction(a,async({operations})=>{operations.execute(native.manager.id,c);entered();await gate;});
   await waiting;
   await pg.admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='iway_operations_fixture' AND state='idle in transaction'");
   release();await assert.rejects(transaction);assert.deepEqual(await persisted(),before);
   await restart();assert.equal((await transact(a,ops=>ops.execute(native.manager.id,c))).status,'draft');
   assert.equal(await transact(b,ops=>ops.store.list('load',b.tenantId).length),0);
   await assert.rejects(engine.transaction({...a,actorId:b.actorId},()=>true),error=>error.code==='AUTHORIZATION');
  });
  await t.test('actual database server restart preserves durable resources, idempotency and audit with tenant isolation',async()=>{
   const c=newCommand(),result=await transact(a,ops=>ops.execute(native.manager.id,c)),before=await persisted();
   await pool.end();pool=null;await pg.restartDatabase();
   pool=new Pool(config);pool.on('error',()=>{});engine=new DurableOperationsPgEngine({pool,config,operationsOptions:{now}});
   assert.deepEqual(await persisted(),before);assert.deepEqual(await transact(a,ops=>ops.execute(native.manager.id,c)),result);
   const afterReplay=await persisted();assert.deepEqual(afterReplay.payload,before.payload);assert.deepEqual(afterReplay.audit,before.audit);
   assert.equal(BigInt(afterReplay.version),BigInt(before.version)+1n); // Engine transaction version advances; business result and audit do not.
   assert.equal(await transact(b,ops=>ops.store.list('load',b.tenantId).length),0);
   assert.deepEqual(await engine.health(),{storage:'postgresql',identityVerified:true,restrictedRole:true,rls:true,scope:'tenant'});
  });
 }finally{if(pool)await pool.end();await pg.cleanup();}
});
