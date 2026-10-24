// Disposable staging sequence, using the exact reviewed SQL and actual LOGIN identities.
// No .env files, linked database, production data, or provider credentials are read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {applyOperationsMigrations} from '../../scripts/lib/operations-migrations.mjs';
import {assertAuthDatabaseReady} from '../../server/operations-auth-database-check.mjs';
import {assertUatPostgresRuntime} from '../../server/operations-uat-postgres.mjs';

const sql=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
const roles=['iway_auth_runtime','iway_uat_runtime','iway_operations_runtime'];
const schemas=['iway_private','iway_uat_private','operations_engine_private'];
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const tenants=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const plan=['db/review-only/iway_auth_role_b513.sql','docs/certification/b446-supabase-auth-tenant-roles-staging.sql','db/review-only/iway_private_auth_sessions_b512.sql','db/review-only/b631-broker-remediation.sql','db/review-only/b662-operations-engine.sql'];
test('combined staging schema on actual restricted PostgreSQL 17 logins',{timeout:180000},async t=>{
 assert.equal(process.env.IWAY_STAGING_SCHEMA_LOCAL_OPT_IN,'true');
 const cluster=await isolatedPostgres({optIn:true,expectedMajor:17,bootstrapOperations:false});
 const passwords=roles.map(()=>randomBytes(32).toString('hex')),pools=[];
 const snapshot=async()=>({
  tables:(await cluster.admin.query("SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND c.relkind='r' ORDER BY 1,2",[schemas])).rows,
  policies:(await cluster.admin.query('SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname=ANY($1) ORDER BY 1,2,3',[schemas])).rows,
  grants:(await cluster.admin.query('SELECT grantee,table_schema,table_name,privilege_type FROM information_schema.role_table_grants WHERE grantee=ANY($1) ORDER BY 1,2,3,4',[roles])).rows
 });
 try{
  await t.test('exact reviewed auth upgrade, broker install and Operations migration order',async()=>{
   assert.equal(Math.floor(cluster.version.number/10000),17);
   await cluster.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)');
   await cluster.admin.query(await sql(plan[0]));
   for(let i=0;i<roles.length;i++){
    // These passwords are generated hex in this process; never command arguments or evidence.
    await cluster.admin.query((i?'CREATE ROLE '+roles[i]+' LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD ':'ALTER ROLE '+roles[i]+' PASSWORD ')+"'"+passwords[i]+"'");
   }
   await cluster.admin.query('INSERT INTO auth.users VALUES($1),($2)',ids);
   for(const path of plan.slice(1,4))await cluster.admin.query(await sql(path));
   const applied=await applyOperationsMigrations(cluster.admin);assert.equal(applied.applied.length,4);
   await cluster.admin.query(await sql(plan[4]));
   for(let i=0;i<roles.length;i++)pools.push(cluster.createPool({user:roles[i],password:passwords[i]}));
  });
  await t.test('three genuine session identities, verified TLS and no elevated capabilities',async()=>{
   for(let i=0;i<roles.length;i++){
    const client=await pools[i].connect();try{
     const row=(await client.query("SELECT session_user,current_user,rolsuper,rolinherit,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,(SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) AS memberships FROM pg_roles r WHERE rolname=current_user")).rows[0];
     assert.deepEqual(row,{session_user:roles[i],current_user:roles[i],rolsuper:false,rolinherit:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,tls:true,memberships:0});
     assert.equal(client.connection.stream.authorized,true);
     for(const query of ['CREATE ROLE forbidden_runtime','CREATE TABLE public.forbidden_runtime(id int)','SET ROLE iway_fixture_admin'])await assert.rejects(client.query(query),e=>e.code==='42501');
    }finally{client.release();}
   }
   assert.equal(await assertAuthDatabaseReady({query:(...args)=>pools[0].query(...args)}),true);
   assert.equal(await assertUatPostgresRuntime(pools[1]),true);
  });
  await t.test('all sixteen application tables FORCE RLS; runtime schemas remain separate',async()=>{
   const shape=await snapshot();assert.equal(shape.tables.length,16);assert.ok(shape.tables.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
   for(let i=0;i<roles.length;i++)for(let j=0;j<schemas.length;j++)if(i!==j)await assert.rejects(pools[i].query('SELECT * FROM '+schemas[j]+'.'+(['auth_tenants','state','state'][j])),e=>e.code==='42501');
  });
  await cluster.admin.query('INSERT INTO iway_private.auth_tenants VALUES($1,true),($2,true)',tenants);
  for(let i=0;i<2;i++){
   await cluster.admin.query("INSERT INTO iway_private.auth_tenant_roles(user_id,tenant_id,role,active,permissions,principal_id) VALUES($1,$2,'carrier',true,ARRAY['load:view'],$1)",[ids[i],tenants[i]]);
   await cluster.admin.query('INSERT INTO operations_engine_private.realms(tenant_id) VALUES($1)',[tenants[i]]);
   await cluster.admin.query('INSERT INTO operations_engine_private.principals(tenant_id,actor_id) VALUES($1,$2)',[tenants[i],ids[i]]);
   await cluster.admin.query("INSERT INTO operations_engine_private.state(tenant_id,version,payload) VALUES($1,1,'{}')",[tenants[i]]);
  }
  await t.test('auth memberships require canonical user context; Operations denies forged tenant and actor',async()=>{
   for(let i=0;i<2;i++){
    const auth=await pools[0].connect(),ops=await pools[2].connect();try{
     await auth.query('BEGIN');await auth.query("SELECT set_config('iway.user_id',$1,true)",[ids[i]]);
     assert.deepEqual((await auth.query('SELECT user_id FROM iway_private.auth_tenant_roles')).rows,[{user_id:ids[i]}]);
     await ops.query('BEGIN');await ops.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true)",[tenants[i],ids[i]]);
     assert.deepEqual((await ops.query('SELECT tenant_id FROM operations_engine_private.state')).rows,[{tenant_id:tenants[i]}]);
     assert.equal((await ops.query('UPDATE operations_engine_private.state SET version=version+1 WHERE tenant_id=$1',[tenants[1-i]])).rowCount,0);
     await ops.query("SELECT set_config('iway.actor_id',$1,true)",[ids[1-i]]);
     assert.equal((await ops.query('SELECT * FROM operations_engine_private.state')).rowCount,0);
    }finally{await auth.query('ROLLBACK');auth.release();await ops.query('ROLLBACK');ops.release();}
   }
   assert.equal((await pools[2].query('SELECT * FROM operations_engine_private.state')).rowCount,0);
  });
  await t.test('reapplication preserves data and security; versioned Operations migration checksums match',async()=>{
   const before=await snapshot();
   for(const path of [plan[2],plan[3],plan[4]])await cluster.admin.query(await sql(path));
   const repeated=await applyOperationsMigrations(cluster.admin);assert.equal(repeated.applied.length,0);assert.equal(repeated.skipped.length,4);
   assert.deepEqual(await snapshot(),before);
   assert.equal((await cluster.admin.query('SELECT count(*)::int AS n FROM iway_private.auth_tenant_roles')).rows[0].n,2);
   assert.equal((await cluster.admin.query('SELECT count(*)::int AS n FROM operations_engine_private.state')).rows[0].n,2);
  });
  await t.test('failed Operations change rolls back schema, grants, policies and data atomically',async()=>{
   const before=await snapshot(),client=await cluster.admin.connect();try{
    await client.query('BEGIN');
    await client.query((await sql(plan[4])).replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,''));
    await client.query('UPDATE operations_engine_private.state SET version=2');
    await assert.rejects(client.query('UPDATE operations_engine_private.state SET version=0'),e=>e.code==='23514');
   }finally{await client.query('ROLLBACK');client.release();}
   assert.deepEqual(await snapshot(),before);
   assert.deepEqual((await cluster.admin.query('SELECT DISTINCT version FROM operations_engine_private.state')).rows,[{version:'1'}]);
   assert.equal(await assertAuthDatabaseReady({query:(...args)=>pools[0].query(...args)}),true);
   assert.equal(await assertUatPostgresRuntime(pools[1]),true);
  });
  t.diagnostic('STAGING_SCHEMA_EVIDENCE '+JSON.stringify({version:cluster.version,roles,forceRlsTables:16,sequence:plan,operationsVersionedMigrations:4,hostedExecuted:false,authSystemFixture:'minimal auth.users identity catalog; no GoTrue service'}));
 }finally{await cluster.cleanup();}
});
