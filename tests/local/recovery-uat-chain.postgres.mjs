// Explicit disposable integration of all four current schema dependencies.
// Minimal auth.users is a fixture, never managed Supabase recovery certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {applyOperationsMigrations} from '../../scripts/lib/operations-migrations.mjs';
import {assertAuthDatabaseReady} from '../../server/operations-auth-database-check.mjs';
import {assertUatPostgresRuntime} from '../../server/operations-uat-postgres.mjs';
import {assertUatManagementRuntime} from '../../server/operations-uat-management-postgres.mjs';
test('B951 all current Auth, broker, durable Operations and management schemas coexist on PostgreSQL17',{timeout:180000},async t=>{
 assert.equal(process.env.IWAY_RECOVERY_CHAIN_OPT_IN,'true');
 const pg=await isolatedPostgres({optIn:true,expectedMajor:17,bootstrapOperations:false});
 const roles=['iway_auth_runtime','iway_uat_runtime','iway_operations_runtime','iway_uat_management_runtime'],passwords=roles.map(()=>randomBytes(32).toString('hex')),pools=[];
 const sql=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
 try{
  await t.test('exact reviewed dependency order installs without granting a runtime administrative access',async()=>{
   await pg.admin.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)');
   await pg.admin.query(await sql('db/review-only/iway_auth_role_b513.sql'));
   for(let i=0;i<roles.length;i++)await pg.admin.query((i?'CREATE ROLE '+roles[i]+' LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ':'ALTER ROLE '+roles[i]+' PASSWORD ')+"'"+passwords[i]+"'");
   for(const path of ['docs/certification/b446-supabase-auth-tenant-roles-staging.sql','db/review-only/iway_private_auth_sessions_b512.sql','db/review-only/b631-broker-remediation.sql'])await pg.admin.query(await sql(path));
   await applyOperationsMigrations(pg.admin);
   for(const path of ['db/review-only/b662-operations-engine.sql','db/review-only/b710-uat-management.sql'])await pg.admin.query(await sql(path));
   for(let i=0;i<roles.length;i++)pools.push(pg.createPool({user:roles[i],password:passwords[i]}));
  });
  await t.test('all four sessions authenticate as their own restricted identity with verified client TLS',async()=>{
   for(let i=0;i<roles.length;i++){const client=await pools[i].connect();try{
    const r=(await client.query('SELECT session_user,current_user,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(r.session_user,roles[i]);assert.equal(r.current_user,roles[i]);for(const key of ['rolsuper','rolbypassrls','rolinherit','rolcreaterole','rolcreatedb','rolreplication'])assert.equal(r[key],false);
    assert.equal(client.connection.stream.encrypted,true);assert.equal(client.connection.stream.authorized,true);
   }finally{client.release()}}
  });
  await t.test('Auth, broker and management catalog validators accept the combined schema',async()=>{
   assert.equal(await assertAuthDatabaseReady({query:(...args)=>pools[0].query(...args)}),true);
   assert.equal(await assertUatPostgresRuntime(pools[1]),true);
   assert.equal(await assertUatManagementRuntime(pools[3]),true);
  });
  await t.test('durable Operations tables retain FORCE RLS and deny missing context',async()=>{
   const tables=(await pools[2].query("SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_engine_private' AND c.relkind='r'")).rows;
   assert.equal(tables.length,5);assert.ok(tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity));
   assert.equal((await pools[2].query('SELECT * FROM operations_engine_private.state')).rowCount,0);
  });
  await t.test('management cannot inspect business state and application roles cannot read management custody',async()=>{
   await assert.rejects(pools[3].query('SELECT * FROM operations_engine_private.state'),e=>e.code==='42501');
   for(const pool of pools.slice(0,3))await assert.rejects(pool.query('SELECT * FROM iway_uat_management_private.commands'),e=>e.code==='42501');
  });
 }finally{await Promise.allSettled(pools.map(p=>p.end()));await pg.cleanup()}
});
