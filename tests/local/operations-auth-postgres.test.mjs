import {authFixture,seedAuthFixture,deactivateAuthFixture} from '../fixtures/auth-identities.mjs';
import {assertAuthDatabaseReady} from '../../server/operations-auth-database-check.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import pg from 'pg';
import {createServerTokenCipher} from '../../server/operations-supabase-token-cipher.experimental.mjs';
import {createPostgresPkceTransactionStore} from '../../server/operations-supabase-pkce-postgres-store.experimental.mjs';
import {createPostgresOpaqueSessionStore} from '../../server/operations-supabase-opaque-session-store.experimental.mjs';
import {createPrivateResourceAuthorizer} from '../../server/operations-auth-authorization.mjs';
import {createAuthApplication} from '../../server/operations-auth-application.mjs';
const user='11111111-1111-4111-8111-111111111111',otherUser='22222222-2222-4222-8222-222222222222';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',otherTenant='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const resource='cccccccc-cccc-4ccc-8ccc-cccccccccccc',otherResource='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
test('isolated real PostgreSQL auth persistence, refresh, RLS and HTTP lifecycle',{timeout:60000},async t=>{
 assert.equal(process.env.IWAY_AUTH_FIXTURE,'true');assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'iway_auth_fixture');
 const admin=new pg.Pool({max:3}),runtime=new pg.Pool({user:'iway_auth_runtime',password:'runtime_fixture_only',max:12,statement_timeout:2000});
 runtime.on('error',()=>{});
 const cipher=createServerTokenCipher({key:randomBytes(32)});
 const query=(sql,args)=>runtime.query(sql,args);
 const tx=createPostgresPkceTransactionStore({query,cipher}),sessions=createPostgresOpaqueSessionStore({query,cipher});
 const tokenPair=()=>({user:{id:user},accessToken:'synthetic-next-access',refreshToken:'synthetic-next-refresh',accessExpiresAt:new Date(Date.now()+300000)});
 const makeSession=()=>sessions.create({userId:user,accessToken:'synthetic-access',refreshToken:'synthetic-refresh',accessExpiresAt:new Date(Date.now()+300000)});
 try{
  await admin.query("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);");
  await admin.query(await readFile(new URL('../../db/review-only/iway_auth_role_b513.sql',import.meta.url),'utf8'));
  await admin.query("ALTER ROLE iway_auth_runtime PASSWORD 'runtime_fixture_only'"); // Synthetic disposable credential only.
  await admin.query('INSERT INTO auth.users VALUES($1),($2)',[user,otherUser]);
  // Recreate the historical B446 contract, not an asserted live schema snapshot.
  await admin.query(await readFile(new URL('../../docs/certification/b446-supabase-auth-tenant-roles-staging.sql',import.meta.url),'utf8'));
  await admin.query("ALTER TABLE iway_private.auth_tenant_roles RENAME CONSTRAINT auth_tenant_roles_user_id_fkey TO existing_identity_reference");
  await admin.query("INSERT INTO iway_private.auth_tenant_roles(user_id,tenant_id,role) VALUES($1,$2,'driver')",[otherUser,tenant]);
  const legacyRole=(await admin.query('SELECT user_id,tenant_id,role,granted_at,revoked_at FROM iway_private.auth_tenant_roles')).rows;
  const legacyKeys=(await admin.query("SELECT oid,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='iway_private.auth_tenant_roles'::regclass AND contype IN ('p','f','c') ORDER BY oid")).rows;
  await admin.query(await readFile(new URL('../../db/review-only/iway_private_auth_sessions_b512.sql',import.meta.url),'utf8'));
  await t.test('B512 preserves populated B446 records, key OIDs, existing CASCADE semantics and deny-default grants',async()=>{
   assert.deepEqual((await admin.query('SELECT user_id,tenant_id,role,granted_at,revoked_at FROM iway_private.auth_tenant_roles')).rows,legacyRole);
   assert.deepEqual((await admin.query("SELECT oid,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='iway_private.auth_tenant_roles'::regclass AND conname IN ('auth_tenant_roles_pkey','auth_tenant_roles_role_check','existing_identity_reference') ORDER BY oid")).rows,legacyKeys);
   const row=(await admin.query('SELECT active,permissions,principal_id,fleet_id FROM iway_private.auth_tenant_roles')).rows[0];
   assert.deepEqual(row,{active:false,permissions:[],principal_id:null,fleet_id:null});
   const policies=(await admin.query('SELECT oid,polname FROM pg_policy ORDER BY oid')).rows;
   await admin.query(await readFile(new URL('../../db/review-only/iway_private_auth_sessions_b512.sql',import.meta.url),'utf8'));
   assert.deepEqual((await admin.query('SELECT oid,polname FROM pg_policy ORDER BY oid')).rows,policies);
   await admin.query(await readFile(new URL('../../db/review-only/iway_auth_preflight_b512.sql',import.meta.url),'utf8'));
   await runtime.query(await readFile(new URL('../../db/review-only/iway_auth_postflight_b512.sql',import.meta.url),'utf8'));
   await admin.query(await readFile(new URL('../../db/review-only/iway_auth_catalog_b498.sql',import.meta.url),'utf8'));
   assert.equal(await assertAuthDatabaseReady({query}),true);
  });

  await admin.query('INSERT INTO iway_private.auth_tenants VALUES($1,true),($2,true)',[tenant,otherTenant]);
  await admin.query("INSERT INTO iway_private.auth_tenant_roles(user_id,tenant_id,role,active,permissions,principal_id,fleet_id) VALUES($1,$2,'carrier',true,ARRAY['load:view'],$1,$2),($3,$4,'carrier',true,ARRAY['load:view'],$3,$4)",[user,tenant,otherUser,otherTenant]);
  await admin.query("INSERT INTO iway_private.auth_resources(resource_id,tenant_id,kind,fleet_id,driver_id,active) VALUES($1,$2,'load',$2,$3,true),($4,$5,'load',$5,$6,true)",[resource,tenant,user,otherResource,otherTenant,otherUser]);
  await t.test('migration upgrade deactivates legacy expiry and remains idempotent without cascaded deletion',async()=>{
   const legacy='0'.repeat(64);
   await admin.query("INSERT INTO iway_private.auth_server_sessions(session_hash,user_id,access_token,refresh_token,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[legacy,user,cipher.encrypt('synthetic-legacy-access'),cipher.encrypt('synthetic-legacy-refresh')]);
   await admin.query('ALTER TABLE iway_private.auth_pkce_transactions ALTER COLUMN verifier SET NOT NULL');
   await admin.query(await readFile(new URL('../../db/review-only/iway_private_auth_sessions_b512.sql',import.meta.url),'utf8'));
   const row=(await admin.query('SELECT revoked_at,access_token,refresh_token FROM iway_private.auth_server_sessions WHERE session_hash=$1',[legacy])).rows[0];
   assert.ok(row.revoked_at);assert.equal(row.access_token,null);assert.equal(row.refresh_token,null);
   const column=(await admin.query("SELECT attnotnull FROM pg_attribute WHERE attrelid='iway_private.auth_pkce_transactions'::regclass AND attname='verifier'")).rows[0];assert.equal(column.attnotnull,false);
   await assert.rejects(admin.query('DELETE FROM auth.users WHERE id=$1',[user]),error=>['23503','23001'].includes(error.code));
  });
  await t.test('migration rejects incompatible columns and unreviewed policies without partial changes',async()=>{
   const migration=(await readFile(new URL('../../db/review-only/iway_private_auth_sessions_b512.sql',import.meta.url),'utf8')).replace('BEGIN;','').replace(/COMMIT;\s*$/,'');
   for(const mutation of [
    "ALTER TABLE iway_private.auth_server_sessions RENAME COLUMN expires_at TO incorrect_expiry",
    "ALTER TABLE iway_private.auth_server_sessions ALTER COLUMN access_expires_at TYPE text USING access_expires_at::text",
    "CREATE POLICY unexpected_allow ON iway_private.auth_resources USING(true)",
    "ALTER TABLE iway_private.auth_resources DROP CONSTRAINT auth_resources_pkey",
    "ALTER TABLE iway_private.auth_resources DROP CONSTRAINT auth_resources_tenant_id_fkey",
    "DROP INDEX iway_private.iway_pkce_expiry_idx; CREATE INDEX iway_pkce_expiry_idx ON iway_private.auth_pkce_transactions(created_at)",
    "ALTER TABLE iway_private.auth_pkce_transactions ADD COLUMN unexpected text NOT NULL",
    "ALTER POLICY auth_runtime_roles ON iway_private.auth_tenant_roles USING(true)",
    "ALTER TABLE iway_private.auth_tenant_roles DROP CONSTRAINT existing_identity_reference",
    "ALTER TABLE iway_private.auth_tenant_roles DROP CONSTRAINT existing_identity_reference; ALTER TABLE iway_private.auth_tenant_roles ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE SET NULL"
   ]){
    const client=await admin.connect();try{await client.query('BEGIN');await client.query(mutation);
     await assert.rejects(client.query(migration),/AUTH_SCHEMA_/);
    }finally{await client.query('ROLLBACK');client.release();}
   }
   assert.equal(await assertAuthDatabaseReady({query}),true);
  });
  await t.test('runtime detects column grants, changed policies and role membership',async()=>{
   assert.equal(await assertAuthDatabaseReady({query}),true);
   await admin.query('GRANT CREATE ON SCHEMA public TO iway_auth_runtime');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query('REVOKE CREATE ON SCHEMA public FROM iway_auth_runtime');}
   await admin.query('GRANT UPDATE(active) ON iway_private.auth_tenants TO iway_auth_runtime');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query('REVOKE UPDATE(active) ON iway_private.auth_tenants FROM iway_auth_runtime');}
   await admin.query('ALTER POLICY auth_runtime_resources ON iway_private.auth_resources USING(true)');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query("ALTER POLICY auth_runtime_resources ON iway_private.auth_resources USING(active AND EXISTS(SELECT 1 FROM iway_private.auth_tenants t WHERE t.tenant_id=auth_resources.tenant_id))");}
   await admin.query('CREATE ROLE fixture_untrusted NOLOGIN; GRANT fixture_untrusted TO iway_auth_runtime');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query('REVOKE fixture_untrusted FROM iway_auth_runtime');}
   await admin.query('CREATE ROLE fixture_member NOLOGIN; GRANT iway_auth_runtime TO fixture_member');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query('REVOKE iway_auth_runtime FROM fixture_member');}
   await admin.query('CREATE SCHEMA unrelated_business; CREATE TABLE unrelated_business.records(id int); GRANT SELECT ON unrelated_business.records TO iway_auth_runtime');
   try{await assert.rejects(assertAuthDatabaseReady({query}),/AUTH_DATABASE_PRIVILEGES_INVALID/);}finally{await admin.query('REVOKE SELECT ON unrelated_business.records FROM iway_auth_runtime');}
   assert.equal(await assertAuthDatabaseReady({query}),true);
  });
  await t.test('runtime privilege and RLS boundaries are real',async()=>{
   assert.equal((await runtime.query('SELECT current_user')).rows[0].current_user,'iway_auth_runtime');
   assert.equal((await runtime.query('SELECT * FROM iway_private.auth_tenant_roles')).rowCount,0);
   assert.equal((await runtime.query('SELECT * FROM iway_private.auth_resources')).rowCount,0);
   for(const sql of ["DELETE FROM iway_private.auth_server_sessions","UPDATE iway_private.auth_tenant_roles SET active=true","SELECT * FROM auth.users","CREATE TABLE iway_private.forbidden(id int)"]){
    await assert.rejects(runtime.query(sql),error=>error.code==='42501');
   }
   const policy=await admin.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity");
   assert.equal(policy.rows[0].n,5);
   const acl=await admin.query("SELECT has_table_privilege('anon','iway_private.auth_server_sessions','SELECT') AS anon,has_table_privilege('authenticated','iway_private.auth_server_sessions','SELECT') AS authenticated");
   assert.deepEqual(acl.rows[0],{anon:false,authenticated:false});
  });
  await t.test('ten simultaneous PKCE consumers produce one winner and retained erased metadata',async()=>{
   const state=randomBytes(32).toString('base64url');await tx.save({state,verifier:'v'.repeat(43)});
   const results=await Promise.all(Array.from({length:10},()=>tx.consume(state)));
   assert.equal(results.filter(Boolean).length,1);
   const retained=await admin.query('SELECT verifier,consumed_at FROM iway_private.auth_pkce_transactions');
   assert.equal(retained.rowCount,1);assert.equal(retained.rows[0].verifier,null);assert.ok(retained.rows[0].consumed_at);
   const expired=randomBytes(32).toString('base64url');await tx.save({state:expired,verifier:'v'.repeat(43)});
   await admin.query("UPDATE iway_private.auth_pkce_transactions SET expires_at=now()-interval '1 second' WHERE consumed_at IS NULL");
   assert.equal(await tx.consume(expired),null);assert.equal(await tx.expire(),1);
  });
  await t.test('concurrent refresh exchanges once and keeps one opaque session',async()=>{
   const {id}=await makeSession();let calls=0,release,started;
   const barrier=new Promise(r=>release=r),entered=new Promise(r=>started=r);
   const refresh=async()=>{calls++;started();await barrier;return tokenPair();};
   const first=sessions.refresh(id,refresh);await entered;
   assert.equal(await sessions.get(id),null);
   const rest=await Promise.all(Array.from({length:8},()=>sessions.refresh(id,refresh)));
   assert.ok(rest.every(x=>x===null));release();assert.equal((await first).id,id);assert.equal(calls,1);
   assert.equal((await sessions.get(id)).access_token,'synthetic-next-access');
   const row=(await admin.query('SELECT token_version,access_token,refresh_token FROM iway_private.auth_server_sessions WHERE revoked_at IS NULL')).rows[0];
   assert.equal(Number(row.token_version),1);assert.ok(row.access_token.startsWith('v1.'));assert.ok(row.refresh_token.startsWith('v1.'));
  });
  await t.test('logout wins against in-flight refresh; uncertain provider outcomes revoke',async()=>{
   const {id}=await makeSession();let release,started;
   const barrier=new Promise(r=>release=r),entered=new Promise(r=>started=r);
   const pending=sessions.refresh(id,async()=>{started();await barrier;return tokenPair();});
   await entered;await sessions.revoke(id);release();await assert.rejects(pending,/SESSION_REFRESH_FAILED/);assert.equal(await sessions.get(id),null);
   const failure=await makeSession();await assert.rejects(sessions.refresh(failure.id,async()=>{throw Error('synthetic failure');}),/SESSION_REFRESH_FAILED/);assert.equal(await sessions.get(failure.id),null);
  });
  await t.test('stale refresh claim recovers by revocation; restart preserves unrelated sessions',async()=>{
   const stale=await makeSession(),active=await makeSession();
   await admin.query("UPDATE iway_private.auth_server_sessions SET refresh_claim='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',refresh_started_at=now()-interval '1 minute' WHERE session_hash=encode(sha256($1::bytea),'hex')",[Buffer.from(stale.id)]);
   assert.equal(await sessions.recoverStale(),1);assert.equal(await sessions.get(stale.id),null);
   const restarted=createPostgresOpaqueSessionStore({query,cipher});assert.ok(await restarted.get(active.id));
   const client=await runtime.connect();client.on('error',()=>{});
   const pid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   await admin.query('SELECT pg_terminate_backend($1)',[pid]);await assert.rejects(client.query('SELECT 1'));client.release(true);
   assert.ok(await restarted.get(active.id));
  });
  await t.test('refresh persistence failure preserves denial until restricted storage recovers',async()=>{
   const {id}=await makeSession();let exchanges=0;
   try{
    await assert.rejects(sessions.refresh(id,async()=>{exchanges++;await admin.query('REVOKE UPDATE ON iway_private.auth_server_sessions FROM iway_auth_runtime');return tokenPair();}),/SESSION_REFRESH_FAILED/);
    assert.equal(await sessions.get(id),null);assert.equal(exchanges,1);
   }finally{await admin.query('GRANT UPDATE ON iway_private.auth_server_sessions TO iway_auth_runtime');}
   assert.equal(await sessions.refresh(id,async()=>{exchanges++;return tokenPair();}),null);assert.equal(exchanges,1);
   await admin.query("UPDATE iway_private.auth_server_sessions SET refresh_started_at=now()-interval '1 minute' WHERE session_hash=encode(sha256($1::bytea),'hex')",[Buffer.from(id)]);
   await sessions.recoverStale();assert.equal(await sessions.get(id),null);
   const healthy=await makeSession();assert.ok(await sessions.get(healthy.id));
  });
  await t.test('absolute expiry denies lookup and refresh and erases tokens during recovery',async()=>{
   const item=await makeSession();
   await admin.query("UPDATE iway_private.auth_server_sessions SET expires_at=now()-interval '1 second' WHERE session_hash=encode(sha256($1::bytea),'hex')",[Buffer.from(item.id)]);
   assert.equal(await sessions.get(item.id),null);let exchanges=0;
   assert.equal(await sessions.refresh(item.id,async()=>{exchanges++;return tokenPair();}),null);assert.equal(exchanges,0);
   await sessions.recoverStale();
   const row=(await admin.query("SELECT revoked_at,access_token,refresh_token FROM iway_private.auth_server_sessions WHERE session_hash=encode(sha256($1::bytea),'hex')",[Buffer.from(item.id)])).rows[0];
   assert.ok(row.revoked_at);assert.equal(row.access_token,null);assert.equal(row.refresh_token,null);
  });
  await t.test('four roles, permissions, tenant and relationship isolation',async()=>{
   const authorize=createPrivateResourceAuthorizer({pool:runtime});
   assert.equal(await authorize({userId:user,resourceId:resource}),true);
   assert.equal(await authorize({userId:user,resourceId:otherResource}),false);
   for(const role of ['fleet','driver','platform']){
    await admin.query("UPDATE iway_private.auth_tenant_roles SET role=$1,permissions=ARRAY['load:view'] WHERE user_id=$2",[role,user]);
    assert.equal(await authorize({userId:user,resourceId:resource}),role!=='platform');
   }
   await admin.query("UPDATE iway_private.auth_resources SET kind='tenant-audit' WHERE resource_id=$1",[resource]);
   await admin.query("UPDATE iway_private.auth_tenant_roles SET permissions=ARRAY['platform:audit'] WHERE user_id=$1",[user]);
   assert.equal(await authorize({userId:user,resourceId:resource}),true);
   await admin.query("UPDATE iway_private.auth_tenant_roles SET role='fleet',permissions=ARRAY['load:view'],fleet_id=$1 WHERE user_id=$2",[otherTenant,user]);
   await admin.query("UPDATE iway_private.auth_resources SET kind='load' WHERE resource_id=$1",[resource]);
   assert.equal(await authorize({userId:user,resourceId:resource}),false);
   await admin.query("UPDATE iway_private.auth_tenant_roles SET role='carrier',fleet_id=$1 WHERE user_id=$2",[tenant,user]);
   await admin.query("UPDATE iway_private.auth_tenants SET active=false WHERE tenant_id=$1",[tenant]);assert.equal(await authorize({userId:user,resourceId:resource}),false);
   await admin.query("UPDATE iway_private.auth_tenants SET active=true WHERE tenant_id=$1",[tenant]);
   await admin.query("UPDATE iway_private.auth_tenant_roles SET revoked_at=now() WHERE user_id=$1",[user]);assert.equal(await authorize({userId:user,resourceId:resource}),false);
   await admin.query("UPDATE iway_private.auth_tenant_roles SET revoked_at=NULL WHERE user_id=$1",[user]);
  });
  await t.test('four distinct deterministic fixture identities enforce scope and retain deactivated evidence',async()=>{
   const client=await admin.connect();const f=authFixture;
   const authorize=createPrivateResourceAuthorizer({pool:runtime});
   try{
    await assert.rejects(seedAuthFixture(client,{...process.env,IWAY_AUTH_FIXTURE:'false'}),/ISOLATED_AUTH_FIXTURE_REQUIRED/);
    await seedAuthFixture(client);await seedAuthFixture(client);
    for(const [role,userId] of Object.entries(f.users)){
     assert.equal(await authorize({userId,resourceId:f.resources.own}),role!=='platform');
     assert.equal(await authorize({userId,resourceId:f.resources.crossTenant}),false);
     assert.equal(await authorize({userId,resourceId:f.resources.crossFleet}),role==='carrier');
     assert.equal(await authorize({userId,resourceId:f.resources.audit}),role==='platform');
    }
    await deactivateAuthFixture(client);await deactivateAuthFixture(client);
    for(const userId of Object.values(f.users))assert.equal(await authorize({userId,resourceId:f.resources.own}),false);
    const retained=await client.query('SELECT count(*)::int AS n,bool_and(NOT active AND revoked_at IS NOT NULL) AS inactive FROM iway_private.auth_tenant_roles WHERE user_id=ANY($1::uuid[])',[Object.values(f.users)]);
    assert.deepEqual(retained.rows[0],{n:4,inactive:true});
   }finally{await deactivateAuthFixture(client);client.release();}
  });
  await t.test('real HTTP to restricted PostgreSQL login-to-logout and replay',async()=>{
   const origin='https://staging.example.org';
   const provider={authorizationUrl:({challenge})=>'https://provider.example/authorize?code_challenge='+challenge,
    exchangeCode:async()=>tokenPair(),getUser:async()=>({id:user}),refresh:async()=>tokenPair(),logout:async()=>{}};
   const app=createAuthApplication({origin,provider,transactions:tx,sessions,authorizeResource:createPrivateResourceAuthorizer({pool:runtime})});
   const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const base='http://127.0.0.1:'+server.address().port;
   const send=(path,method='GET',cookie)=>fetch(base+path,{method,redirect:'manual',headers:{origin,...(cookie?{cookie}:{})}});
   try{
    let r=await send('/auth/login','POST');assert.equal(r.status,303);const binding=r.headers.getSetCookie()[0].split(';')[0];
    assert.equal((await send('/auth/callback?code=synthetic')).status,401);
    r=await send('/auth/callback?code=synthetic','GET',binding);assert.equal(r.status,303);
    const cookie=r.headers.getSetCookie().find(x=>x.startsWith('__Host-iway-session=')).split(';')[0];
    assert.equal((await send('/auth/callback?code=synthetic','GET',binding)).status,401);
    assert.equal((await send('/auth/session','GET',cookie)).status,200);
    assert.equal((await send('/api/resources/'+resource+'/verify','GET',cookie)).status,200);
    assert.equal((await send('/api/resources/'+otherResource+'/verify','GET',cookie)).status,403);
    r=await send('/auth/refresh','POST',cookie);assert.equal(r.status,200);assert.equal((await r.text()).includes('synthetic'),false);
    assert.equal((await send('/auth/logout','POST',cookie)).status,200);
    assert.equal((await send('/auth/session','GET',cookie)).status,401);
   }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
  });
 }finally{await runtime.end();await admin.end();}
});
