import {applyOperationsMigrations,operationsMigrationFiles} from '../../scripts/lib/operations-migrations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {Pool} from 'pg';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {AsyncOperationsPgStore,buildLocalOperationsPgConfig} from '../../server/operations-postgres.mjs';
import {createAsyncLoad} from '../../domain/operations-async-load.mjs';
import {renameAsyncLoad} from '../../domain/operations-async-load-rename.mjs';
import {noteAsyncLoad} from '../../domain/operations-async-load-note.mjs';
import {noteAsyncShipment} from '../../domain/operations-async-shipment-note.mjs';
import {dispatchAsyncShipment} from '../../domain/operations-async-shipment-dispatch.mjs';
import {assignAsyncShipment} from '../../domain/operations-async-shipment-assign.mjs';
import {releaseAsyncShipment} from '../../domain/operations-async-shipment-release.mjs';
import {reassignAsyncShipment} from '../../domain/operations-async-shipment-reassign.mjs';
import {recordAsyncTrackingEvent} from '../../domain/operations-async-tracking-event.mjs';
import {projectAsyncShipmentTracking} from '../../domain/operations-async-tracking-projection.mjs';

// Explicit opt-in; never load environment files or connect to an existing database.
test('disposable PostgreSQL Operations certification',async t=>{
 assert.equal(process.env.IWAY_OPERATIONS_LOCAL_OPT_IN,'1','Explicit disposable-cluster approval required');
 const f=await isolatedPostgres({optIn:true});t.after(()=>f.cleanup());
 const config=buildLocalOperationsPgConfig({optIn:true,connection:f.restricted,ca:f.ssl.ca});
 const pool=new Pool(config);t.after(()=>pool.end());
 const store=new AsyncOperationsPgStore(pool,{config});
 const a={tenantId:randomUUID(),actorId:randomUUID()},b={tenantId:randomUUID(),actorId:randomUUID()},other=randomUUID();
 for(const scope of [a,b]){
  await f.admin.query('INSERT INTO operations_private.tenants VALUES($1,$2,$3)',[scope.tenantId,'Illustrative fixture','America/Chicago']);
  await f.admin.query('INSERT INTO operations_private.users VALUES($1,$2,$3,$4,$5)',[scope.tenantId,scope.actorId,'fixture',JSON.stringify({id:scope.actorId,tenantId:scope.tenantId,role:'carrier',permissions:['load:create'],active:true}),'unusable-fixture-hash']);
 }
 await f.admin.query('INSERT INTO operations_private.users VALUES($1,$2,$3,$4,$5)',[a.tenantId,other,'other',JSON.stringify({id:other,tenantId:a.tenantId,role:'dispatcher',active:true}),'unusable-fixture-hash']);
 const command=()=>({action:'load:create',idempotencyKey:randomUUID(),payload:{reference:'Illustrative',customer:'Illustrative customer',dispatcherId:other,commodity:'Freight',weightLb:1000,stops:[{type:'pickup',location:'Austin',at:'2026-11-01T10:00:00.000Z'},{type:'delivery',location:'Dallas',at:'2026-11-02T10:00:00.000Z'}],rateCents:10000,charges:[],factored:false}});
 // This bounded port requires a trusted authorizer; HTTP/session parity remains a separate gate.
 const create=(c,extra={})=>createAsyncLoad({store,scope:a,command:c,authorizeLoad:async({principal})=>principal.role==='carrier'&&principal.permissions.includes('load:create'),...extra});
 const counts=async()=>{const r=await f.admin.query('SELECT (SELECT count(*) FROM operations_private.resources)::int AS resources,(SELECT count(*) FROM operations_private.commands)::int AS commands,(SELECT count(*) FROM operations_private.audit)::int AS audit');return r.rows[0]};
 const raw=async(scope,work)=>{const c=await f.pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true)",[scope.tenantId,scope.actorId]);return await work(c)}finally{await c.query('ROLLBACK');c.release()}};
 let load;
 await t.test('verified TLS, restricted role, migrations and forced RLS',async()=>{
  assert.deepEqual(await store.health(),{identityVerified:true,tlsVerified:true,restrictedRole:true});
  const {rows}=await f.admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_private' AND c.relkind='r'");
  assert.equal(rows.length,7);assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
 });
 await t.test('atomic load/shipment/audit/command and concurrent replay',async()=>{
  const c=command(),before=await counts(),started=performance.now();const results=await Promise.all(Array.from({length:12},()=>create(c)));load=results[0];t.diagnostic(JSON.stringify({scope:'disposable PostgreSQL same-key contention',requests:12,elapsedMs:performance.now()-started}));
  assert.ok(results.every(x=>x.id===load.id));assert.deepEqual(await counts(),{resources:before.resources+2,commands:before.commands+1,audit:before.audit+1});
  const shipments=await store.transaction(a,tx=>tx.list('shipment'));assert.equal(shipments.filter(x=>x.loadId===load.id).length,1);
  await assert.rejects(create({...c,payload:{...c.payload,reference:'Conflict'}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(create(c,{authorizeLoad:async()=>false}),{code:'FORBIDDEN'});
 });
 await t.test('concurrent conflicting commands commit exactly one pair',async()=>{
  const c=command(),before=await counts(),results=await Promise.allSettled([create(c),create({...c,payload:{...c.payload,reference:'Other'}})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(await counts(),{resources:before.resources+2,commands:before.commands+1,audit:before.audit+1});
 });
 for(const table of ['resources','commands','audit'])await t.test(table+' persistence failure rolls back all records and permits retry',async()=>{
  const c=command(),before=await counts();
  await f.admin.query(`CREATE FUNCTION operations_private.fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='fixture failure'; END $$`);
  await f.admin.query(`CREATE TRIGGER fixture_failure BEFORE INSERT ON operations_private.${table} FOR EACH ROW ${table==='resources'?"WHEN (NEW.kind='shipment')":''} EXECUTE FUNCTION operations_private.fixture_failure()`);
  try{await assert.rejects(create(c),{code:'RETRY_TRANSACTION'});assert.deepEqual(await counts(),before)}finally{await f.admin.query(`DROP TRIGGER fixture_failure ON operations_private.${table}`);await f.admin.query('DROP FUNCTION operations_private.fixture_failure()')}
  await create(c);assert.deepEqual(await counts(),{resources:before.resources+2,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('load rename uses real PostgreSQL transaction, audit and idempotent replay',async()=>{
  const before=await counts(),existing=await store.transaction(a,tx=>tx.get('load',load.id));
  const c={action:'load:rename',resourceId:load.id,expectedVersion:existing.version,idempotencyKey:randomUUID(),payload:{reference:'Renamed fixture'}};
  const rename=(command=c,extra={})=>renameAsyncLoad({store,scope:a,command,authorizeLoad:async({principal})=>principal.role==='carrier'&&principal.permissions.includes('load:create'),...extra});
  const first=await rename();
  assert.equal(first.reference,'Renamed fixture');assert.equal(first.version,existing.version+1);
  assert.deepEqual(await rename(),first);
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
  await assert.rejects(rename({...c,payload:{reference:'Changed'}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(rename(c,{authorizeLoad:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(rename({...c,idempotencyKey:randomUUID()}),{code:'STALE'});
  await assert.rejects(rename({...c,idempotencyKey:randomUUID(),payload:{reference:'Invalid',tenantId:b.tenantId}}),{code:'FIELDS'});
  await assert.rejects(renameAsyncLoad({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeLoad:async()=>true}),{code:'NOT_FOUND'});
  assert.equal((await store.transaction(a,tx=>tx.get('load',load.id))).reference,'Renamed fixture');
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('load note is authorized, replay-safe, versioned and tenant-isolated on PostgreSQL',async()=>{
  const before=await counts(),existing=await store.transaction(a,tx=>tx.get('load',load.id));
  const c={action:'load:note',resourceId:load.id,expectedVersion:existing.version,idempotencyKey:randomUUID(),payload:{note:'Verified delivery window'}};
  const note=(command=c,extra={})=>noteAsyncLoad({store,scope:a,command,authorizeLoad:async({principal})=>principal.active&&principal.permissions.includes('load:create'),...extra});
  const result=await note();
  assert.equal(result.note,'Verified delivery window');assert.equal(result.version,existing.version+1);
  assert.deepEqual(await note(),result);
  await assert.rejects(note({...c,payload:{note:'Different'}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(note(c,{authorizeLoad:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(note({...c,idempotencyKey:randomUUID()}),{code:'STALE'});
  await assert.rejects(note({...c,idempotencyKey:randomUUID(),payload:{note:'x',status:'delivered'}}),{code:'FIELDS'});
  await assert.rejects(noteAsyncLoad({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeLoad:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('shipment note requires same-tenant parent, authorization and atomic replay',async()=>{
  const shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===load.id);
  assert.ok(shipment);
  const before=await counts();
  const c={action:'shipment:note',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{note:'Pickup appointment confirmed'}};
  const note=(command=c,extra={})=>noteAsyncShipment({store,scope:a,command,authorizeShipment:async({principal})=>principal.active&&principal.permissions.includes('load:create'),...extra});
  const first=await note();assert.equal(first.note,'Pickup appointment confirmed');assert.equal(first.version,shipment.version+1);
  assert.deepEqual(await note(),first);
  await assert.rejects(note(c,{authorizeShipment:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(note({...c,payload:{note:'Other'}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(note({...c,idempotencyKey:randomUUID()}),{code:'STALE'});
  await assert.rejects(note({...c,idempotencyKey:randomUUID(),payload:{note:'Valid',loadId:randomUUID()}}),{code:'FIELDS'});
  await assert.rejects(noteAsyncShipment({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeShipment:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('shipment dispatch atomically transitions load and shipment with replay and tenant fences',async()=>{
  const c0=command(),created=await create(c0);
  const shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  assert.ok(shipment);
  const before=await counts();
  const c={action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}};
  const dispatch=(cmd=c,extra={})=>dispatchAsyncShipment({store,scope:a,command:cmd,authorizeDispatch:async({principal})=>principal.active&&principal.permissions.includes('load:create'),...extra});
  const first=await dispatch();assert.equal(first.status,'dispatched');
  assert.equal((await store.transaction(a,tx=>tx.get('load',created.id))).status,'dispatched');
  assert.deepEqual(await dispatch(),first);
  await assert.rejects(dispatch(c,{authorizeDispatch:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(dispatch({...c,payload:{force:true}}),{code:'IDEMPOTENCY_CONFLICT'});
  await assert.rejects(dispatch({...c,idempotencyKey:randomUUID()}),{code:'INVALID_TRANSITION'});
  await assert.rejects(dispatch({...c,idempotencyKey:randomUUID(),payload:{force:true}}),{code:'FIELDS'});
  await assert.rejects(dispatchAsyncShipment({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeDispatch:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('shipment assignment atomically reserves driver and vehicle and updates parent load',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const driver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const before=await counts();
  const c={action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:driver.id,vehicleId:vehicle.id}};
  const assign=(cmd=c,extra={})=>assignAsyncShipment({store,scope:a,command:cmd,authorizeAssignment:async({principal})=>principal.active&&principal.permissions.includes('load:create'),...extra});
  const result=await assign();assert.equal(result.driverId,driver.id);assert.equal(result.vehicleId,vehicle.id);
  const state=await store.transaction(a,async tx=>({load:await tx.get('load',created.id),driver:await tx.get('driver',driver.id),vehicle:await tx.get('vehicle',vehicle.id)}));
  assert.equal(state.load.driverId,driver.id);assert.equal(state.load.vehicleId,vehicle.id);
  assert.equal(state.driver.available,false);assert.equal(state.vehicle.available,false);
  assert.deepEqual(await assign(),result);
  await assert.rejects(assign(c,{authorizeAssignment:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(assign({...c,idempotencyKey:randomUUID()}),{code:'ALREADY_ASSIGNED'});
  await assert.rejects(assign({...c,idempotencyKey:randomUUID(),payload:{...c.payload,force:true}}),{code:'FIELDS'});
  await assert.rejects(assignAsyncShipment({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeAssignment:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('shipment release atomically clears assignment and restores resource availability',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const driver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const assignCommand={action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:driver.id,vehicleId:vehicle.id}};
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const assigned=await assignAsyncShipment({store,scope:a,command:assignCommand,authorizeAssignment:auth});
  const before=await counts();
  const c={action:'shipment:release',resourceId:shipment.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),payload:{}};
  const release=(cmd=c,extra={})=>releaseAsyncShipment({store,scope:a,command:cmd,authorizeRelease:auth,...extra});
  const result=await release();assert.equal(result.driverId,null);assert.equal(result.vehicleId,null);
  const state=await store.transaction(a,async tx=>({load:await tx.get('load',created.id),driver:await tx.get('driver',driver.id),vehicle:await tx.get('vehicle',vehicle.id)}));
  assert.equal(state.load.driverId,null);assert.equal(state.load.vehicleId,null);
  assert.equal(state.driver.available,true);assert.equal(state.vehicle.available,true);
  assert.deepEqual(await release(),result);
  await assert.rejects(release(c,{authorizeRelease:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(release({...c,idempotencyKey:randomUUID()}),{code:'STALE'});
  await assert.rejects(release({...c,idempotencyKey:randomUUID(),payload:{force:true}}),{code:'FIELDS'});
  await assert.rejects(releaseAsyncShipment({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeRelease:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('shipment reassignment atomically swaps reservations and synchronizes load',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const oldDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const oldVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const newDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const newVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const assigned=await assignAsyncShipment({store,scope:a,command:{action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:oldDriver.id,vehicleId:oldVehicle.id}},authorizeAssignment:auth});
  const before=await counts();
  const c={action:'shipment:reassign',resourceId:shipment.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),payload:{driverId:newDriver.id,vehicleId:newVehicle.id}};
  const reassign=(cmd=c,extra={})=>reassignAsyncShipment({store,scope:a,command:cmd,authorizeReassignment:auth,...extra});
  const result=await reassign();assert.equal(result.driverId,newDriver.id);assert.equal(result.vehicleId,newVehicle.id);
  const state=await store.transaction(a,async tx=>({load:await tx.get('load',created.id),oldDriver:await tx.get('driver',oldDriver.id),oldVehicle:await tx.get('vehicle',oldVehicle.id),newDriver:await tx.get('driver',newDriver.id),newVehicle:await tx.get('vehicle',newVehicle.id)}));
  assert.equal(state.load.driverId,newDriver.id);assert.equal(state.load.vehicleId,newVehicle.id);
  assert.equal(state.oldDriver.available,true);assert.equal(state.oldVehicle.available,true);
  assert.equal(state.newDriver.available,false);assert.equal(state.newVehicle.available,false);
  assert.deepEqual(await reassign(),result);
  await assert.rejects(reassign(c,{authorizeReassignment:async()=>false}),{code:'FORBIDDEN'});
  await assert.rejects(reassign({...c,idempotencyKey:randomUUID()}),{code:'STALE'});
  await assert.rejects(reassign({...c,idempotencyKey:randomUUID(),payload:{...c.payload,force:true}}),{code:'FIELDS'});
  await assert.rejects(reassignAsyncShipment({store,scope:b,command:{...c,idempotencyKey:randomUUID()},authorizeReassignment:async()=>true}),{code:'NOT_FOUND'});
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('concurrent assignments cannot reserve the same driver and vehicle twice',async()=>{
  const first=await create(command()),second=await create(command());
  const shipments=await store.transaction(a,tx=>tx.list('shipment'));
  const one=shipments.find(x=>x.loadId===first.id),two=shipments.find(x=>x.loadId===second.id);
  const driver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const before=await counts();
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const invoke=shipment=>assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:driver.id,vehicleId:vehicle.id}}});
  const results=await Promise.allSettled([invoke(one),invoke(two)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='RESOURCE_UNAVAILABLE').length,1);
  const state=await store.transaction(a,async tx=>({one:await tx.get('shipment',one.id),two:await tx.get('shipment',two.id),driver:await tx.get('driver',driver.id),vehicle:await tx.get('vehicle',vehicle.id)}));
  assert.equal([state.one,state.two].filter(x=>x.driverId===driver.id&&x.vehicleId===vehicle.id).length,1);
  assert.equal(state.driver.available,false);assert.equal(state.vehicle.available,false);
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('failed reassignment rolls back tentative driver reservation',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const oldDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const oldVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const newDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const unavailableVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:false}));
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const assigned=await assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:oldDriver.id,vehicleId:oldVehicle.id}}});
  const before=await counts();
  await assert.rejects(reassignAsyncShipment({store,scope:a,authorizeReassignment:auth,command:{action:'shipment:reassign',resourceId:shipment.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),payload:{driverId:newDriver.id,vehicleId:unavailableVehicle.id}}}),{code:'RESOURCE_UNAVAILABLE'});
  const state=await store.transaction(a,async tx=>({shipment:await tx.get('shipment',shipment.id),load:await tx.get('load',created.id),oldDriver:await tx.get('driver',oldDriver.id),oldVehicle:await tx.get('vehicle',oldVehicle.id),newDriver:await tx.get('driver',newDriver.id),unavailableVehicle:await tx.get('vehicle',unavailableVehicle.id)}));
  assert.equal(state.shipment.driverId,oldDriver.id);assert.equal(state.shipment.vehicleId,oldVehicle.id);
  assert.equal(state.load.driverId,oldDriver.id);assert.equal(state.load.vehicleId,oldVehicle.id);
  assert.equal(state.oldDriver.available,false);assert.equal(state.oldVehicle.available,false);
  assert.equal(state.newDriver.available,true);assert.equal(state.unavailableVehicle.available,false);
  assert.deepEqual(await counts(),before);
 });
 await t.test('concurrent reassignments serialize and preserve a single reserved replacement',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const oldDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const oldVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const firstDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const firstVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const secondDriver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const secondVehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const assigned=await assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:oldDriver.id,vehicleId:oldVehicle.id}}});
  const before=await counts();
  const invoke=(driverId,vehicleId)=>reassignAsyncShipment({store,scope:a,authorizeReassignment:auth,command:{action:'shipment:reassign',resourceId:shipment.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),payload:{driverId,vehicleId}}});
  const results=await Promise.allSettled([invoke(firstDriver.id,firstVehicle.id),invoke(secondDriver.id,secondVehicle.id)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='STALE').length,1);
  const state=await store.transaction(a,async tx=>({shipment:await tx.get('shipment',shipment.id),load:await tx.get('load',created.id),oldDriver:await tx.get('driver',oldDriver.id),oldVehicle:await tx.get('vehicle',oldVehicle.id),firstDriver:await tx.get('driver',firstDriver.id),firstVehicle:await tx.get('vehicle',firstVehicle.id),secondDriver:await tx.get('driver',secondDriver.id),secondVehicle:await tx.get('vehicle',secondVehicle.id)}));
  assert.equal(state.load.driverId,state.shipment.driverId);assert.equal(state.load.vehicleId,state.shipment.vehicleId);
  assert.equal(state.oldDriver.available,true);assert.equal(state.oldVehicle.available,true);
  assert.equal([state.firstDriver,state.secondDriver].filter(x=>x.available===false).length,1);
  assert.equal([state.firstVehicle,state.secondVehicle].filter(x=>x.available===false).length,1);
  assert.equal(state.shipment.driverId===firstDriver.id||state.shipment.driverId===secondDriver.id,true);
  assert.equal(state.shipment.vehicleId===firstVehicle.id||state.shipment.vehicleId===secondVehicle.id,true);
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('ten-checkpoint shipment lifecycle: assign, dispatch, reassign, release and reuse',async()=>{
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const first=await create(command()),second=await create(command());
  const shipments=await store.transaction(a,tx=>tx.list('shipment'));
  const one=shipments.find(x=>x.loadId===first.id),two=shipments.find(x=>x.loadId===second.id);
  const driverA=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicleA=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const driverB=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicleB=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const before=await counts();
  const assigned=await assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:one.id,expectedVersion:one.version,idempotencyKey:randomUUID(),payload:{driverId:driverA.id,vehicleId:vehicleA.id}}});
  assert.equal(assigned.driverId,driverA.id); // 1
  assert.equal(assigned.vehicleId,vehicleA.id); // 2
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:one.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),payload:{}}});
  assert.equal(dispatched.status,'dispatched'); // 3
  assert.equal((await store.transaction(a,tx=>tx.get('load',first.id))).status,'dispatched'); // 4
  const reassigned=await reassignAsyncShipment({store,scope:a,authorizeReassignment:auth,command:{action:'shipment:reassign',resourceId:one.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{driverId:driverB.id,vehicleId:vehicleB.id}}});
  assert.equal(reassigned.driverId,driverB.id); // 5
  assert.equal((await store.transaction(a,tx=>tx.get('driver',driverA.id))).available,true); // 6
  const released=await releaseAsyncShipment({store,scope:a,authorizeRelease:auth,command:{action:'shipment:release',resourceId:one.id,expectedVersion:reassigned.version,idempotencyKey:randomUUID(),payload:{}}});
  assert.equal(released.driverId,null); // 7
  assert.equal((await store.transaction(a,tx=>tx.get('vehicle',vehicleB.id))).available,true); // 8
  const reused=await assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:two.id,expectedVersion:two.version,idempotencyKey:randomUUID(),payload:{driverId:driverB.id,vehicleId:vehicleB.id}}});
  assert.equal(reused.driverId,driverB.id); // 9
  const state=await store.transaction(a,async tx=>({first:await tx.get('load',first.id),second:await tx.get('load',second.id),driverA:await tx.get('driver',driverA.id),vehicleA:await tx.get('vehicle',vehicleA.id),driverB:await tx.get('driver',driverB.id),vehicleB:await tx.get('vehicle',vehicleB.id)}));
  assert.equal(state.first.driverId,null);assert.equal(state.first.vehicleId,null);
  assert.equal(state.second.driverId,driverB.id);assert.equal(state.second.vehicleId,vehicleB.id);
  assert.equal(state.driverA.available,true);assert.equal(state.vehicleA.available,true);
  assert.equal(state.driverB.available,false);assert.equal(state.vehicleB.available,false);
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+5,audit:before.audit+5}); // 10
 });
 await t.test('released resources have exactly one winner under concurrent reuse',async()=>{
  const original=await create(command()),candidateA=await create(command()),candidateB=await create(command());
  const shipments=await store.transaction(a,tx=>tx.list('shipment'));
  const originalShipment=shipments.find(x=>x.loadId===original.id);
  const aShipment=shipments.find(x=>x.loadId===candidateA.id),bShipment=shipments.find(x=>x.loadId===candidateB.id);
  const driver=await store.transaction(a,tx=>tx.insert('driver',{active:true,available:true}));
  const vehicle=await store.transaction(a,tx=>tx.insert('vehicle',{active:true,available:true}));
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const assign=(shipment)=>assignAsyncShipment({store,scope:a,authorizeAssignment:auth,command:{action:'shipment:assign',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{driverId:driver.id,vehicleId:vehicle.id}}});
  const reserved=await assign(originalShipment);
  const released=await releaseAsyncShipment({store,scope:a,authorizeRelease:auth,command:{action:'shipment:release',resourceId:originalShipment.id,expectedVersion:reserved.version,idempotencyKey:randomUUID(),payload:{}}});
  assert.equal(released.driverId,null);assert.equal(released.vehicleId,null);
  const before=await counts();
  const results=await Promise.allSettled([assign(aShipment),assign(bShipment)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.code==='RESOURCE_UNAVAILABLE').length,1);
  const state=await store.transaction(a,async tx=>({original:await tx.get('shipment',originalShipment.id),a:await tx.get('shipment',aShipment.id),b:await tx.get('shipment',bShipment.id),loadA:await tx.get('load',candidateA.id),loadB:await tx.get('load',candidateB.id),driver:await tx.get('driver',driver.id),vehicle:await tx.get('vehicle',vehicle.id)}));
  assert.equal(state.original.driverId,null);
  assert.equal([state.a,state.b].filter(x=>x.driverId===driver.id&&x.vehicleId===vehicle.id).length,1);
  assert.equal(state.a.driverId,state.loadA.driverId);assert.equal(state.b.driverId,state.loadB.driverId);
  assert.equal(state.driver.available,false);assert.equal(state.vehicle.available,false);
  assert.deepEqual(await counts(),{resources:before.resources,commands:before.commands+1,audit:before.audit+1});
 });
 await t.test('tracking event command enforces ten transactional checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const base={action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType:'arrived',occurredAt:'2026-11-01T10:00:00.000Z',location:'Austin terminal'}};
  const record=(cmd=base,extra={})=>recordAsyncTrackingEvent({store,scope:a,command:cmd,authorizeTracking:auth,...extra});
  const before=await counts();
  const first=await record();
  assert.equal(first.kind,'tracking'); // 1
  assert.equal(first.shipmentId,shipment.id); // 2
  assert.equal(first.eventType,'arrived'); // 3
  assert.equal(first.occurredAt,base.payload.occurredAt); // 4
  assert.deepEqual(await record(),first); // 5
  await assert.rejects(record(base,{authorizeTracking:async()=>false}),{code:'FORBIDDEN'}); // 6
  await assert.rejects(record({...base,payload:{...base.payload,location:'Changed'}}),{code:'IDEMPOTENCY_CONFLICT'}); // 7
  await assert.rejects(record({...base,idempotencyKey:randomUUID(),expectedVersion:dispatched.version+1}),{code:'STALE'}); // 8
  await assert.rejects(record({...base,idempotencyKey:randomUUID(),payload:{...base.payload,extra:'unexpected'}}),{code:'FIELDS'}); // 9
  await assert.rejects(recordAsyncTrackingEvent({store,scope:b,command:{...base,idempotencyKey:randomUUID()},authorizeTracking:async()=>true}),{code:'NOT_FOUND'});
  const events=await store.transaction(a,tx=>tx.list('tracking'));
  assert.equal(events.filter(x=>x.shipmentId===shipment.id&&x.id===first.id).length,1);
  assert.deepEqual(await counts(),{resources:before.resources+1,commands:before.commands+1,audit:before.audit+1}); // 10
 });
 await t.test('tracking ingestion accepts distinct concurrent events and deduplicates replay',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const first={action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType:'arrived',occurredAt:'2026-11-01T10:00:00.000Z',location:'Austin'}};
  const second={action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType:'departed',occurredAt:'2026-11-01T11:00:00.000Z',location:'Austin'}};
  const record=command=>recordAsyncTrackingEvent({store,scope:a,command,authorizeTracking:auth});
  const before=await counts();
  const results=await Promise.allSettled([record(first),record(second),record(first)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,3);
  const [aResult,bResult,replay]=results.map(x=>x.value);
  assert.deepEqual(aResult,replay);
  assert.notEqual(aResult.id,bResult.id);
  assert.equal(aResult.occurredAt< bResult.occurredAt,true);
  const events=(await store.transaction(a,tx=>tx.list('tracking'))).filter(x=>x.shipmentId===shipment.id);
  assert.equal(events.length,2);
  assert.equal(events.filter(x=>x.eventType==='arrived').length,1);
  assert.equal(events.filter(x=>x.eventType==='departed').length,1);
  assert.equal((await store.transaction(a,tx=>tx.get('shipment',shipment.id))).version,dispatched.version);
  assert.deepEqual(await counts(),{resources:before.resources+2,commands:before.commands+2,audit:before.audit+2});
 });
 await t.test('tracking event ordering and semantic deduplication enforce ten invariants',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const cmd=(eventType,occurredAt,location='Austin')=>({action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType,occurredAt,location}});
  const record=command=>recordAsyncTrackingEvent({store,scope:a,command,authorizeTracking:auth});
  const first=cmd('arrived','2026-11-01T10:00:00.000Z');
  const saved=await record(first);
  assert.equal(saved.eventType,'arrived'); // 1
  const before=await counts();
  await assert.rejects(record({...first,idempotencyKey:randomUUID()}),{code:'DUPLICATE_EVENT'}); // 2
  await assert.rejects(record(cmd('departed','2026-11-01T09:59:59.000Z')),{code:'OUT_OF_ORDER_EVENT'}); // 3
  assert.deepEqual(await record(first),saved); // 4
  const second=await record(cmd('departed','2026-11-01T11:00:00.000Z'));
  assert.equal(second.eventType,'departed'); // 5
  const sameTime=await record(cmd('in_transit','2026-11-01T11:00:00.000Z'));
  assert.equal(sameTime.occurredAt,second.occurredAt); // 6
  await assert.rejects(record(cmd('in_transit','2026-11-01T11:00:00.000Z')),{code:'DUPLICATE_EVENT'}); // 7
  const history=(await store.transaction(a,tx=>tx.list('tracking'))).filter(x=>x.shipmentId===shipment.id);
  assert.equal(history.length,3); // 8
  assert.equal((await store.transaction(a,tx=>tx.get('shipment',shipment.id))).version,dispatched.version); // 9
  assert.deepEqual(await counts(),{resources:before.resources+2,commands:before.commands+2,audit:before.audit+2}); // 10
 });
 await t.test('shipment tracking projection enforces ten read-only checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const view=scope=>projectAsyncShipmentTracking({store,scope,shipmentId:shipment.id,authorizeTracking:auth});
  const before=await counts(),empty=await view(a);
  assert.equal(empty.shipmentId,shipment.id); // 1
  assert.equal(empty.latestEvent,null); // 2
  assert.deepEqual(empty.history,[]); // 3
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const record=(eventType,occurredAt,location)=>recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType,occurredAt,location}}});
  await record('arrived','2026-11-01T10:00:00.000Z','Austin');
  await record('departed','2026-11-01T11:00:00.000Z','Austin');
  const snapshot=await counts(),projection=await view(a);
  assert.equal(projection.history.length,2); // 4
  assert.deepEqual(projection.history.map(x=>x.eventType),['arrived','departed']); // 5
  assert.equal(projection.latestEvent.eventType,'departed'); // 6
  assert.equal(projection.latestLocation,'Austin'); // 7
  assert.equal(projection.status,'dispatched'); // 8
  await assert.rejects(view(b),{code:'NOT_FOUND'}); // 9
  assert.deepEqual(await counts(),snapshot); // 10
  assert.equal(before.resources+2,snapshot.resources);
 });
 await t.test('shipment-scoped tracking cursor and index pass twenty checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const add=async(eventType,occurredAt,location)=>recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType,occurredAt,location}}});
  const t0='2026-11-01T10:00:00.000Z',t1='2026-11-01T11:00:00.000Z',t2='2026-11-01T12:00:00.000Z';
  const e0=await add('arrived',t0,'Austin'),e1=await add('departed',t1,'Austin'),e2=await add('in_transit',t2,'Dallas');
  const history=(options={})=>store.transaction(a,tx=>tx.trackingHistory(shipment.id,options));
  const all=await history();
  assert.equal(all.length,3); // 1
  assert.deepEqual(all.map(x=>x.id),[e2.id,e1.id,e0.id]); // 2
  assert.equal(all[0].shipmentId,shipment.id); // 3
  assert.equal(all[0].loadId,created.id); // 4
  assert.equal(all[0].occurredAt,t2); // 5
  assert.equal((await history({limit:1})).length,1); // 6
  assert.equal((await history({limit:1}))[0].id,e2.id); // 7
  const p2=await history({limit:1,before:{occurredAt:t2,id:e2.id}});
  assert.equal(p2.length,1); // 8
  assert.equal(p2[0].id,e1.id); // 9
  const p3=await history({limit:1,before:{occurredAt:t1,id:e1.id}});
  assert.equal(p3[0].id,e0.id); // 10
  assert.deepEqual(await history({limit:1,before:{occurredAt:t0,id:e0.id}}),[]); // 11
  assert.deepEqual(await history({limit:3}),all); // 12
  await assert.rejects(history({limit:0}),{code:'INPUT'}); // 13
  await assert.rejects(history({limit:501}),{code:'INPUT'}); // 14
  await assert.rejects(history({limit:1,before:{occurredAt:'invalid',id:e2.id}}),{code:'INPUT'}); // 15
  await assert.rejects(history({limit:1,before:{occurredAt:t2,id:'invalid'}}),{code:'INPUT'}); // 16
  assert.deepEqual(await store.transaction(b,tx=>tx.trackingHistory(shipment.id)),[]); // 17
  assert.deepEqual(await store.transaction(a,tx=>tx.trackingHistory(randomUUID())),[]); // 18
  const idx=await f.admin.query("SELECT indexname FROM pg_indexes WHERE schemaname='operations_private' AND indexname='operations_tracking_history_idx'");
  assert.equal(idx.rowCount,1); // 19
  const snapshot=await counts();await history({limit:2});assert.deepEqual(await counts(),snapshot); // 20
 });
 await t.test('tracking projection cursor pagination passes twenty read-only checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const view=(options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId:shipment.id,authorizeTracking:auth,...options});
  const empty=await view({limit:1});
  assert.equal(empty.history.length,0); // 1
  assert.equal(empty.latestEvent,null); // 2
  assert.equal(empty.hasMore,false); // 3
  assert.equal(empty.nextCursor,null); // 4
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const record=(eventType,occurredAt,location)=>recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType,occurredAt,location}}});
  const first=await record('arrived','2026-11-01T10:00:00.000Z','Austin'),second=await record('departed','2026-11-01T11:00:00.000Z','Austin'),third=await record('in_transit','2026-11-01T12:00:00.000Z','Dallas');
  const before=await counts(),page1=await view({limit:1});
  assert.equal(page1.history.length,1); // 5
  assert.equal(page1.history[0].id,third.id); // 6
  assert.equal(page1.hasMore,true); // 7
  assert.equal(page1.nextCursor.id,third.id); // 8
  assert.equal(page1.latestEvent.id,third.id); // 9
  assert.equal(page1.latestLocation,'Dallas'); // 10
  const page2=await view({limit:1,before:page1.nextCursor});
  assert.equal(page2.history[0].id,second.id); // 11
  assert.equal(page2.hasMore,true); // 12
  const page3=await view({limit:1,before:page2.nextCursor});
  assert.equal(page3.history[0].id,first.id); // 13
  assert.equal(page3.hasMore,false); // 14
  assert.equal(page3.nextCursor,null); // 15
  assert.equal(page3.latestEvent.id,third.id); // 16
  assert.deepEqual((await view({limit:3})).history.map(x=>x.id),[first.id,second.id,third.id]); // 17
  await assert.rejects(view({limit:0}),{code:'INVALID_PAGE'}); // 18
  await assert.rejects(view({limit:201}),{code:'INVALID_PAGE'}); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking pagination equal timestamps and cursor isolation pass twenty checks',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const stamp='2026-11-01T10:00:00.000Z',events=[];
  for(let i=0;i<7;i++)events.push(await recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:dispatched.version,idempotencyKey:randomUUID(),payload:{eventType:'arrived',occurredAt:stamp,location:'Gate '+i}}}));
  const view=(options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId:shipment.id,authorizeTracking:auth,...options});
  const before=await counts(),all=await view({limit:20});
  assert.equal(all.history.length,7); // 1
  assert.equal(all.hasMore,false); // 2
  assert.equal(all.nextCursor,null); // 3
  assert.ok(all.history.every(e=>e.occurredAt===stamp)); // 4
  assert.equal(new Set(all.history.map(e=>e.id)).size,7); // 5
  assert.deepEqual(all.history.map(e=>e.id),all.history.map(e=>e.id).slice().sort()); // 6
  const first=await view({limit:2});
  assert.equal(first.history.length,2); // 7
  assert.equal(first.hasMore,true); // 8
  assert.equal(first.nextCursor.occurredAt,stamp); // 9
  const second=await view({limit:2,before:first.nextCursor});
  assert.equal(second.history.length,2); // 10
  assert.equal(second.hasMore,true); // 11
  const third=await view({limit:2,before:second.nextCursor});
  assert.equal(third.history.length,2); // 12
  assert.equal(third.hasMore,true); // 13
  const fourth=await view({limit:2,before:third.nextCursor});
  assert.equal(fourth.history.length,1); // 14
  assert.equal(fourth.hasMore,false); // 15
  const combined=[...first.history,...second.history,...third.history,...fourth.history].map(e=>e.id);
  assert.equal(new Set(combined).size,7); // 16
  assert.deepEqual(combined,all.history.map(e=>e.id).slice().reverse().reduce((groups,id,i)=>{groups[Math.floor(i/2)]??=[];groups[Math.floor(i/2)].unshift(id);return groups},[]).flat()); // 17
  await assert.rejects(view({before:{occurredAt:'not-a-date',id:events[0].id}}),{code:'INVALID_PAGE'}); // 18
  await assert.rejects(view({before:{occurredAt:stamp,id:'bad-id'}}),{code:'INVALID_PAGE'}); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking history isolates shipments and paginates twenty larger-history checkpoints',async()=>{
  const firstLoad=await create(command()),secondLoad=await create(command());
  const shipments=await store.transaction(a,tx=>tx.list('shipment'));
  const first=shipments.find(x=>x.loadId===firstLoad.id),second=shipments.find(x=>x.loadId===secondLoad.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatch=shipment=>dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const [d1,d2]=await Promise.all([dispatch(first),dispatch(second)]);
  const record=(shipment,version,minute)=>recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:version,idempotencyKey:randomUUID(),payload:{eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,minute)).toISOString(),location:'Checkpoint '+minute}}});
  for(let i=0;i<12;i++)await record(first,d1.version,i);
  for(let i=0;i<4;i++)await record(second,d2.version,i);
  const page=(shipmentId,options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId,authorizeTracking:auth,...options});
  const before=await counts(),aAll=await page(first.id,{limit:20}),bAll=await page(second.id,{limit:20});
  assert.equal(aAll.history.length,12); // 1
  assert.equal(bAll.history.length,4); // 2
  assert.ok(aAll.history.every(x=>x.shipmentId===first.id)); // 3
  assert.ok(bAll.history.every(x=>x.shipmentId===second.id)); // 4
  assert.equal(aAll.latestLocation,'Checkpoint 11'); // 5
  assert.equal(bAll.latestLocation,'Checkpoint 3'); // 6
  assert.equal(aAll.hasMore,false); // 7
  assert.equal(bAll.hasMore,false); // 8
  const a1=await page(first.id,{limit:5});
  assert.equal(a1.history.length,5); // 9
  assert.equal(a1.hasMore,true); // 10
  const a2=await page(first.id,{limit:5,before:a1.nextCursor});
  assert.equal(a2.history.length,5); // 11
  assert.equal(a2.hasMore,true); // 12
  const a3=await page(first.id,{limit:5,before:a2.nextCursor});
  assert.equal(a3.history.length,2); // 13
  assert.equal(a3.hasMore,false); // 14
  assert.equal(a3.nextCursor,null); // 15
  const combined=[...a1.history,...a2.history,...a3.history].map(x=>x.id);
  assert.equal(new Set(combined).size,12); // 16
  assert.deepEqual(combined,aAll.history.map(x=>x.id).reverse().reduce((pages,id,i)=>{pages[Math.floor(i/5)]??=[];pages[Math.floor(i/5)].unshift(id);return pages},[]).flat()); // 17
  assert.equal((await page(second.id,{limit:2})).history.length,2); // 18
  assert.deepEqual(await store.transaction(b,tx=>tx.trackingHistory(first.id)),[]); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking cursor binds shipment and rejects cross-shipment replay in twenty checks',async()=>{
  const loadA=await create(command()),loadB=await create(command());
  const shipments=await store.transaction(a,tx=>tx.list('shipment')),sa=shipments.find(x=>x.loadId===loadA.id),sb=shipments.find(x=>x.loadId===loadB.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatch=shipment=>dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const [da,db]=await Promise.all([dispatch(sa),dispatch(sb)]);
  const record=(shipment,version,minute)=>recordAsyncTrackingEvent({store,scope:a,authorizeTracking:auth,command:{action:'tracking:record',resourceId:shipment.id,expectedVersion:version,idempotencyKey:randomUUID(),payload:{eventType:'arrived',occurredAt:new Date(Date.UTC(2026,10,1,10,minute)).toISOString(),location:'Gate '+minute}}});
  for(let i=0;i<4;i++){await record(sa,da.version,i);await record(sb,db.version,i)}
  const view=(shipmentId,options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId,authorizeTracking:auth,...options});
  const before=await counts(),pa=await view(sa.id,{limit:2}),pb=await view(sb.id,{limit:2});
  assert.equal(pa.history.length,2); // 1
  assert.equal(pb.history.length,2); // 2
  assert.equal(pa.hasMore,true); // 3
  assert.equal(pb.hasMore,true); // 4
  assert.equal(pa.nextCursor.shipmentId,sa.id); // 5
  assert.equal(pb.nextCursor.shipmentId,sb.id); // 6
  assert.notEqual(pa.nextCursor.shipmentId,pb.nextCursor.shipmentId); // 7
  assert.ok(pa.nextCursor.id); // 8
  assert.ok(pa.nextCursor.occurredAt); // 9
  await assert.rejects(view(sb.id,{limit:2,before:pa.nextCursor}),{code:'INVALID_PAGE'}); // 10
  await assert.rejects(view(sa.id,{limit:2,before:pb.nextCursor}),{code:'INVALID_PAGE'}); // 11
  await assert.rejects(view(sa.id,{limit:2,before:{...pa.nextCursor,shipmentId:randomUUID()}}),{code:'INVALID_PAGE'}); // 12
  await assert.rejects(view(sa.id,{limit:2,before:{occurredAt:pa.nextCursor.occurredAt,id:pa.nextCursor.id}}),{code:'INVALID_PAGE'}); // 13
  await assert.rejects(view(sa.id,{limit:2,before:{...pa.nextCursor,id:'bad'}}),{code:'INVALID_PAGE'}); // 14
  await assert.rejects(view(sa.id,{limit:2,before:{...pa.nextCursor,occurredAt:'bad'}}),{code:'INVALID_PAGE'}); // 15
  const na=await view(sa.id,{limit:2,before:pa.nextCursor});
  assert.equal(na.history.length,2); // 16
  assert.equal(na.hasMore,false); // 17
  const nb=await view(sb.id,{limit:2,before:pb.nextCursor});
  assert.equal(nb.history.length,2); // 18
  assert.equal(nb.hasMore,false); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking projection max page and long history pass twenty checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const dispatched=await dispatchAsyncShipment({store,scope:a,authorizeDispatch:auth,command:{action:'shipment:dispatch',resourceId:shipment.id,expectedVersion:shipment.version,idempotencyKey:randomUUID(),payload:{}}});
  const total=207;
  await store.transaction(a,async tx=>{
   for(let i=0;i<total;i++)await tx.insert('tracking',{shipmentId:shipment.id,loadId:created.id,eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,0,i)).toISOString(),location:'Checkpoint '+i,recordedBy:a.actorId});
  });
  const view=(options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId:shipment.id,authorizeTracking:auth,...options});
  const before=await counts(),first=await view({limit:200});
  assert.equal(first.history.length,200); // 1
  assert.equal(first.hasMore,true); // 2
  assert.equal(first.nextCursor.shipmentId,shipment.id); // 3
  assert.ok(first.nextCursor.id); // 4
  assert.ok(first.nextCursor.occurredAt); // 5
  assert.equal(first.latestLocation,'Checkpoint 206'); // 6
  assert.equal(first.latestEvent.location,'Checkpoint 206'); // 7
  assert.equal(first.history.at(-1).location,'Checkpoint 206'); // 8
  assert.equal(first.history[0].location,'Checkpoint 7'); // 9
  const second=await view({limit:200,before:first.nextCursor});
  assert.equal(second.history.length,7); // 10
  assert.equal(second.hasMore,false); // 11
  assert.equal(second.nextCursor,null); // 12
  assert.equal(second.history[0].location,'Checkpoint 0'); // 13
  assert.equal(second.history.at(-1).location,'Checkpoint 6'); // 14
  assert.equal(second.latestLocation,'Checkpoint 206'); // 15
  const ids=[...first.history,...second.history].map(x=>x.id);
  assert.equal(ids.length,total); // 16
  assert.equal(new Set(ids).size,total); // 17
  assert.deepEqual(ids,(await store.transaction(a,tx=>tx.trackingHistory(shipment.id,{limit:500}))).map(x=>x.id).slice(0,200).reverse().concat((await store.transaction(a,tx=>tx.trackingHistory(shipment.id,{limit:500}))).slice(200).map(x=>x.id).reverse())); // 18
  await assert.rejects(view({limit:201}),{code:'INVALID_PAGE'}); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking history above five hundred events passes twenty checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  const total=503;
  await store.transaction(a,async tx=>{
   for(let i=0;i<total;i++)await tx.insert('tracking',{shipmentId:shipment.id,loadId:created.id,eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,0,i)).toISOString(),location:'Point '+i,recordedBy:a.actorId});
  });
  const view=(options={})=>projectAsyncShipmentTracking({store,scope:a,shipmentId:shipment.id,authorizeTracking:auth,...options});
  const before=await counts(),p1=await view({limit:200});
  assert.equal(p1.history.length,200); // 1
  assert.equal(p1.hasMore,true); // 2
  assert.equal(p1.history.at(-1).location,'Point 502'); // 3
  assert.equal(p1.history[0].location,'Point 303'); // 4
  assert.equal(p1.latestLocation,'Point 502'); // 5
  const p2=await view({limit:200,before:p1.nextCursor});
  assert.equal(p2.history.length,200); // 6
  assert.equal(p2.hasMore,true); // 7
  assert.equal(p2.history.at(-1).location,'Point 302'); // 8
  assert.equal(p2.history[0].location,'Point 103'); // 9
  const p3=await view({limit:200,before:p2.nextCursor});
  assert.equal(p3.history.length,103); // 10
  assert.equal(p3.hasMore,false); // 11
  assert.equal(p3.nextCursor,null); // 12
  assert.equal(p3.history[0].location,'Point 0'); // 13
  assert.equal(p3.history.at(-1).location,'Point 102'); // 14
  assert.equal(p3.latestEvent.location,'Point 502'); // 15
  const all=[...p1.history,...p2.history,...p3.history];
  assert.equal(all.length,total); // 16
  assert.equal(new Set(all.map(x=>x.id)).size,total); // 17
  assert.ok(all.every(x=>x.shipmentId===shipment.id)); // 18
  assert.deepEqual(all.map(x=>Number(x.location.slice(6))),Array.from({length:total},(_,i)=>i).reverse().reduce((groups,n,i)=>{groups[Math.floor(i/200)]??=[];groups[Math.floor(i/200)].unshift(n);return groups},[]).flat()); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking history index plan passes twenty database checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  const auth=async({principal})=>principal.active&&principal.permissions.includes('load:create');
  await store.transaction(a,async tx=>{
   for(let i=0;i<30;i++)await tx.insert('tracking',{shipmentId:shipment.id,loadId:created.id,eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,0,i)).toISOString(),location:'Index '+i,recordedBy:a.actorId});
  });
  const before=await counts(),idx=await f.admin.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='operations_private' AND indexname='operations_tracking_history_idx'");
  assert.equal(idx.rowCount,1); // 1
  assert.match(idx.rows[0].indexdef,/tenant_id/); // 2
  assert.match(idx.rows[0].indexdef,/shipmentId/); // 3
  assert.match(idx.rows[0].indexdef,/occurredAt/); // 4
  assert.match(idx.rows[0].indexdef,/DESC/); // 5
  assert.match(idx.rows[0].indexdef,/tracking/); // 6
  const plan=await f.admin.query("EXPLAIN (FORMAT JSON) SELECT data FROM operations_private.resources WHERE tenant_id=$1 AND kind='tracking' AND data->>'shipmentId'=$2 ORDER BY data->>'occurredAt' DESC,id DESC LIMIT 20",[a.tenantId,shipment.id]);
  assert.equal(plan.rows.length,1); // 7
  const root=plan.rows[0]['QUERY PLAN'][0].Plan;
  assert.ok(root); // 8
  assert.equal(root['Node Type'],'Limit'); // 9
  assert.ok(Number.isFinite(root['Plan Rows'])); // 10
  const nodes=JSON.stringify(root);
  assert.match(nodes,/operations_private|resources|tracking_history_idx/); // 11
  const query=(options={})=>store.transaction(a,tx=>tx.trackingHistory(shipment.id,options));
  const page=await query({limit:20});
  assert.equal(page.length,20); // 12
  assert.equal(page[0].location,'Index 29'); // 13
  assert.equal(page.at(-1).location,'Index 10'); // 14
  const older=await query({limit:20,before:{occurredAt:page.at(-1).occurredAt,id:page.at(-1).id}});
  assert.equal(older.length,10); // 15
  assert.equal(older[0].location,'Index 9'); // 16
  assert.equal(older.at(-1).location,'Index 0'); // 17
  assert.equal(new Set([...page,...older].map(x=>x.id)).size,30); // 18
  assert.equal((await projectAsyncShipmentTracking({store,scope:a,shipmentId:shipment.id,authorizeTracking:auth,limit:20})).history.length,20); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking index forced-plan verification passes twenty checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  await store.transaction(a,async tx=>{
   for(let i=0;i<24;i++)await tx.insert('tracking',{shipmentId:shipment.id,loadId:created.id,eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,0,i)).toISOString(),location:'Plan '+i,recordedBy:a.actorId});
  });
  const before=await counts(),client=await f.admin.connect();
  let plan;
  try{
   await client.query('BEGIN');
   await client.query('SET LOCAL enable_seqscan = off');
   const result=await client.query("EXPLAIN (FORMAT JSON) SELECT data FROM operations_private.resources WHERE tenant_id=$1 AND kind='tracking' AND data->>'shipmentId'=$2 ORDER BY data->>'occurredAt' DESC,id DESC LIMIT 20",[a.tenantId,shipment.id]);
   plan=result.rows[0]['QUERY PLAN'][0].Plan;
   await client.query('ROLLBACK');
  }finally{client.release()}
  const nodes=[],visit=node=>{nodes.push(node);for(const child of node.Plans??[])visit(child)};visit(plan);
  assert.equal(plan['Node Type'],'Limit'); // 1
  assert.ok(nodes.length>=2); // 2
  assert.ok(nodes.some(x=>x['Node Type']==='Index Scan'||x['Node Type']==='Bitmap Index Scan')); // 3
  assert.ok(nodes.some(x=>x['Index Name']==='operations_tracking_history_idx')); // 4
  assert.ok(nodes.some(x=>String(x['Index Cond']??'').includes('tenant_id'))); // 5
  assert.ok(nodes.some(x=>String(x['Index Cond']??'').includes('shipmentId'))); // 6
  assert.ok(nodes.every(x=>typeof x['Node Type']==='string')); // 7
  assert.ok(Number.isFinite(plan['Plan Rows'])); // 8
  const fetch=(options={})=>store.transaction(a,tx=>tx.trackingHistory(shipment.id,options));
  const p1=await fetch({limit:10});
  assert.equal(p1.length,10); // 9
  assert.equal(p1[0].location,'Plan 23'); // 10
  assert.equal(p1.at(-1).location,'Plan 14'); // 11
  const p2=await fetch({limit:10,before:{occurredAt:p1.at(-1).occurredAt,id:p1.at(-1).id}});
  assert.equal(p2.length,10); // 12
  assert.equal(p2[0].location,'Plan 13'); // 13
  assert.equal(p2.at(-1).location,'Plan 4'); // 14
  const p3=await fetch({limit:10,before:{occurredAt:p2.at(-1).occurredAt,id:p2.at(-1).id}});
  assert.equal(p3.length,4); // 15
  assert.equal(p3[0].location,'Plan 3'); // 16
  assert.equal(p3.at(-1).location,'Plan 0'); // 17
  assert.equal(new Set([...p1,...p2,...p3].map(x=>x.id)).size,24); // 18
  assert.deepEqual(await fetch({limit:10,before:{occurredAt:p3.at(-1).occurredAt,id:p3.at(-1).id}}),[]); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('tracking EXPLAIN ANALYZE and query statistics pass twenty checkpoints',async()=>{
  const created=await create(command()),shipment=(await store.transaction(a,tx=>tx.list('shipment'))).find(x=>x.loadId===created.id);
  await store.transaction(a,async tx=>{
   for(let i=0;i<64;i++)await tx.insert('tracking',{shipmentId:shipment.id,loadId:created.id,eventType:'in_transit',occurredAt:new Date(Date.UTC(2026,10,1,10,0,i)).toISOString(),location:'Timing '+i,recordedBy:a.actorId});
  });
  const before=await counts();
  const statement="SELECT data FROM operations_private.resources WHERE tenant_id=$1 AND kind='tracking' AND data->>'shipmentId'=$2 ORDER BY data->>'occurredAt' DESC,id DESC LIMIT 20";
  const explain=async options=>{
   const result=await f.admin.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "+statement,[a.tenantId,shipment.id]);
   return result.rows[0]['QUERY PLAN'][0];
  };
  const warmups=[];
  for(let i=0;i<3;i++)warmups.push(await explain());
  const samples=[];
  for(let i=0;i<21;i++)samples.push(await explain());
  const one=samples[0],two=samples[1];
  const times=samples.map(x=>x['Execution Time']).sort((a,b)=>a-b);
  const median=times[Math.floor(times.length/2)];
  const percentile=p=>times[Math.ceil(p*times.length)-1];
  const report={schemaVersion:2,workload:'tracking-history-indexed-64-events-limit-20',environment:'disposable-postgresql',warmupCount:warmups.length,sampleCount:samples.length,unit:'ms',executionTimeMs:{min:times[0],median,p90:percentile(.9),p95:percentile(.95),max:times.at(-1)},executionSamplesMs:samples.map(x=>x['Execution Time']),planningTimeMs:{median:samples.map(x=>x['Planning Time']).sort((a,b)=>a-b)[Math.floor(samples.length/2)]},rowsReturned:one.Plan['Actual Rows'],planNode:one.Plan['Node Type'],sharedHitBlocks:one.Plan['Shared Hit Blocks'],sharedReadBlocks:one.Plan['Shared Read Blocks'],productionSloCertified:false};
  if(process.env.IWAY_TRACKING_BASELINE_REPORT){
   const target=process.env.IWAY_TRACKING_BASELINE_REPORT;
   mkdirSync(dirname(target),{recursive:true});
   writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  }
  console.log('TRACKING_BASELINE '+JSON.stringify(report));
  assert.ok(one.Plan); // 1
  assert.equal(one.Plan['Node Type'],'Limit'); // 2
  assert.ok(Number.isFinite(one['Planning Time'])); // 3
  assert.ok(Number.isFinite(one['Execution Time'])); // 4
  assert.ok(one['Execution Time']>=0); // 5
  assert.ok(Number.isFinite(two['Execution Time'])); // 6
  assert.ok(two['Execution Time']>=0); // 7
  assert.ok(Number.isFinite(one.Plan['Actual Rows'])); // 8
  assert.equal(one.Plan['Actual Rows'],20); // 9
  assert.equal(two.Plan['Actual Rows'],20); // 10
  assert.ok(Number.isFinite(one.Plan['Actual Total Time'])); // 11
  assert.ok(Number.isFinite(two.Plan['Actual Total Time'])); // 12
  assert.ok(Number.isFinite(one.Plan['Shared Hit Blocks'])); // 13
  assert.ok(one.Plan['Shared Hit Blocks']>=0); // 14
  assert.ok(Number.isFinite(one.Plan['Shared Read Blocks'])); // 15
  assert.ok(one.Plan['Shared Read Blocks']>=0); // 16
  const history=await store.transaction(a,tx=>tx.trackingHistory(shipment.id,{limit:20}));
  assert.equal(history.length,20); // 17
  assert.equal(history[0].location,'Timing 63'); // 18
  assert.equal(history.at(-1).location,'Timing 44'); // 19
  assert.deepEqual(await counts(),before); // 20
 });
 await t.test('optimistic concurrency permits one update and rejects stale version',async()=>{
  const version=(await store.transaction(a,tx=>tx.get('load',load.id))).version;
  const r=await Promise.allSettled([store.transaction(a,tx=>tx.update('load',load.id,version,{status:'validated'})),store.transaction(a,tx=>tx.update('load',load.id,version,{status:'validated'}))]);
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.find(x=>x.status==='rejected').reason.code,'STALE');
 });
 await t.test('cross-tenant, missing and inactive principals cannot read or write',async()=>{
  await assert.rejects(store.transaction({...a,actorId:b.actorId},tx=>tx.list('load')),{code:'AUTHORIZATION'});
  assert.equal((await store.transaction(b,tx=>tx.list('load'))).length,0);
  await raw(b,async c=>{assert.equal((await c.query('SELECT * FROM operations_private.resources')).rowCount,0);await assert.rejects(c.query("INSERT INTO operations_private.resources(tenant_id,kind,id,version,data) VALUES($1,'load',$2,1,$3)",[a.tenantId,randomUUID(),'{}']))});
  await f.admin.query("UPDATE operations_private.users SET data=jsonb_set(data,'{active}','false') WHERE id=$1",[a.actorId]);
  try{await assert.rejects(create(command()),{code:'AUTHORIZATION'});await raw(a,async c=>{for(const table of ['users','tenants','resources','commands','audit','sessions'])assert.equal((await c.query('SELECT * FROM operations_private.'+table)).rowCount,0)})}finally{await f.admin.query("UPDATE operations_private.users SET data=jsonb_set(data,'{active}','true') WHERE id=$1",[a.actorId])}
  const c=await f.pool.connect();try{assert.equal((await c.query('SELECT * FROM operations_private.resources')).rowCount,0)}finally{c.release()}
 });
 await t.test('actor spoofing denied for audit, command evidence and sessions',async()=>{
  for(const sql of [
   {text:"INSERT INTO operations_private.audit(id,tenant_id,actor_id,action,outcome,detail) VALUES($1,$2,$3,'fixture:test','success','{}')",values:[randomUUID(),a.tenantId,other]},
   {text:"INSERT INTO operations_private.commands(tenant_id,actor_id,key,digest,result) VALUES($1,$2,$3,$4,'{}')",values:[a.tenantId,other,randomUUID(),'a'.repeat(64)]},
   {text:"INSERT INTO operations_private.sessions(tenant_id,user_id,token_hash,csrf_hash,expires_at) VALUES($1,$2,'fixture','fixture',now())",values:[a.tenantId,other]}
  ])await raw(a,c=>assert.rejects(c.query(sql),{code:'42501'}));
 });
 await t.test('audit and command mutation and role escalation denied',async()=>{
  for(const table of ['audit','commands'])for(const operation of [`UPDATE operations_private.${table} SET tenant_id=tenant_id`,`DELETE FROM operations_private.${table}`,`TRUNCATE operations_private.${table}`])await raw(a,c=>assert.rejects(c.query(operation),{code:'42501'}));
  await raw(a,c=>assert.rejects(c.query('SET ROLE iway_fixture_admin'),{code:'42501'}));
  // Trigger enforcement remains effective even for the fixture provisioner.
  for(const table of ['audit','commands'])await assert.rejects(f.admin.query('UPDATE operations_private.'+table+' SET tenant_id=tenant_id WHERE false'),{code:'42501'});
 });
 await t.test('dispatcher lookup reveals only active directory data; user records remain self-only',async()=>{
  await raw(a,async c=>{const users=await c.query('SELECT id FROM operations_private.users');assert.deepEqual(users.rows.map(x=>x.id),[a.actorId]);});
  assert.deepEqual(await store.transaction(a,tx=>tx.user(other)),{id:other,tenantId:a.tenantId,role:'dispatcher',active:true});
  assert.equal(await store.transaction(b,tx=>tx.user(other)),null);
  await raw({...a,actorId:other},async c=>assert.equal((await c.query('SELECT * FROM operations_private.dispatcher_directory')).rowCount,0));
  await f.admin.query("UPDATE operations_private.users SET data=jsonb_set(data,'{active}','false') WHERE id=$1",[other]);
  try{const before=await counts();await assert.rejects(create(command()),{code:'INVALID_DISPATCHER'});assert.deepEqual(await counts(),before)}finally{await f.admin.query("UPDATE operations_private.users SET data=jsonb_set(data,'{active}','true') WHERE id=$1",[other])}
 });
 await t.test('migration history is atomic, idempotent and rejects changed checksums',async()=>{
  const repeated=await applyOperationsMigrations(f.admin);assert.deepEqual(repeated.applied,[]);assert.deepEqual(repeated.skipped,operationsMigrationFiles);
  const name=operationsMigrationFiles[0],before=await f.admin.query('SELECT checksum FROM operations_migrations.applied WHERE name=$1',[name]);
  await f.admin.query('UPDATE operations_migrations.applied SET checksum=$1 WHERE name=$2',['invalid-fixture-checksum',name]);
  try{await assert.rejects(applyOperationsMigrations(f.admin),/MIGRATION_CHECKSUM_CHANGED/)}finally{await f.admin.query('UPDATE operations_migrations.applied SET checksum=$1 WHERE name=$2',[before.rows[0].checksum,name])}
  await raw(a,c=>assert.rejects(c.query('SELECT * FROM operations_migrations.applied'),{code:'42501'}));
 });
 await t.test('forced RLS denies all logistics resource kinds and ownership reassignment',async()=>{
  for(const kind of ['shipment','assignment','tracking','document','notification','workflow','approval']){
   const record=await store.transaction(a,tx=>tx.insert(kind,{loadId:load.id,status:'pending'}));
   await assert.rejects(store.transaction(b,tx=>tx.get(kind,record.id)),{code:'NOT_FOUND'});
   await raw(b,async c=>{assert.equal((await c.query('SELECT id FROM operations_private.resources WHERE id=$1',[record.id])).rowCount,0);assert.equal((await c.query('UPDATE operations_private.resources SET version=version+1 WHERE id=$1',[record.id])).rowCount,0)});
   await raw(a,c=>assert.rejects(c.query("UPDATE operations_private.resources SET tenant_id=$1::uuid,data=jsonb_set(data,'{tenantId}',to_jsonb(($1::uuid)::text)) WHERE id=$2",[b.tenantId,record.id]),{code:'42501'}));
  }
 });
 await t.test('concurrent approval evidence updates have one optimistic winner',async()=>{
  const approval=await store.transaction(a,tx=>tx.insert('approval',{loadId:load.id,status:'pending'}));
  const decisions=await Promise.allSettled(['approved','rejected'].map(status=>store.transaction(a,tx=>tx.update('approval',approval.id,1,{status}))));
  assert.equal(decisions.filter(d=>d.status==='fulfilled').length,1);assert.equal(decisions.find(d=>d.status==='rejected').reason.code,'STALE');
  assert.equal((await store.transaction(a,tx=>tx.get('approval',approval.id))).version,2);
 });
 await t.test('pool exhaustion times out and pool recovers without writes',async()=>{
  const limited=f.createPool({max:1,connectionTimeoutMillis:3000});const held=await limited.connect(),before=await counts();
  try{await assert.rejects(limited.connect())}finally{held.release()}
  assert.equal((await limited.query('SELECT 1 AS ok')).rows[0].ok,1);assert.deepEqual(await counts(),before);
 });
});
