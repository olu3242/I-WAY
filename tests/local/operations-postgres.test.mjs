import {applyOperationsMigrations,operationsMigrationFiles} from '../../scripts/lib/operations-migrations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
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
