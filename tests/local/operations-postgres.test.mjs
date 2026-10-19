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
