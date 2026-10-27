import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {createUatPostgresStore,assertUatPostgresRuntime} from '../../server/operations-uat-postgres.mjs';
import {createServerTokenCipher} from '../../server/operations-supabase-token-cipher.experimental.mjs';
import {uatFixture,syntheticRoster,syntheticPassword} from '../helpers/uat-fixture.mjs';
import {createUatWorkflow} from '../../server/operations-uat-workflow.mjs';
test('disposable PostgreSQL UAT broker storage under genuine restricted identity',{timeout:60000},async t=>{
 assert.equal(process.env.IWAY_UAT_LOCAL_OPT_IN,'true');
 const cluster=await isolatedPostgres({optIn:true});let runtime;
 try{
  await cluster.admin.query("CREATE ROLE iway_uat_runtime LOGIN PASSWORD 'uat_synthetic_fixture_only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION");
  await cluster.admin.query(await readFile(new URL('../../db/review-only/iway_uat_state_b574.sql',import.meta.url),'utf8'));
  for(const entry of syntheticRoster)await cluster.admin.query('INSERT INTO iway_uat_private.state(user_id) VALUES($1)',[entry.userId]);
  runtime=new Pool({...cluster.admin.options,user:'iway_uat_runtime',password:'uat_synthetic_fixture_only',max:10,statement_timeout:3000});runtime.on('error',()=>{});
  const store=createUatPostgresStore({pool:runtime,cipher:createServerTokenCipher({key:randomBytes(32)})});
  await t.test('actual session_user/current_user match; owner/admin impersonation and unrelated data are denied',async()=>{
   assert.deepEqual((await runtime.query('SELECT session_user,current_user')).rows[0],{session_user:'iway_uat_runtime',current_user:'iway_uat_runtime'});
   assert.equal(await assertUatPostgresRuntime(runtime),true);await assert.rejects(assertUatPostgresRuntime(cluster.admin),/PRIVILEGES_INVALID/);
   for(const query of ['SELECT * FROM operations_private.tenants','SELECT * FROM iway_uat_private.audit','DELETE FROM iway_uat_private.invites','CREATE TABLE iway_uat_private.forbidden(id int)'])await assert.rejects(runtime.query(query),e=>e.code==='42501');
  });
  await t.test('real persistent issue/setup/password/session/recovery workflow preserves encrypted proof',async()=>{
   const f=uatFixture();try{
    const workflow=createUatWorkflow({...f.dependencies,store});const entry=syntheticRoster[3];
    await workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId});
    const proof=(await cluster.admin.query('SELECT proof FROM iway_uat_private.invites')).rows[0].proof;assert.ok(!proof.includes('synthetic-recovery'));
    await workflow.setup({token:f.mail[0].token,password:syntheticPassword,network:'pg-synthetic'});
    const session=await workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'pg-login'});assert.equal((await workflow.session(session.id)).userId,entry.userId);
    await workflow.issue({adminSession:'synthetic-approved-admin',userId:entry.userId,purpose:'recovery'});assert.equal(await workflow.session(session.id),null);
    const events=(await cluster.admin.query('SELECT event,actor_id FROM iway_uat_private.audit')).rows;assert.ok(events.some(e=>e.event==='invitation.issued'&&e.actor_id));
   }finally{f.db.close();}
  });
  await t.test('concurrent redemption is one-time across pooled connections',async()=>{
   const token=randomBytes(32).toString('base64url'),userId=syntheticRoster[2].userId;
   await store.saveInvite({token,userId,proof:'synthetic-provider-proof',expires:Date.now()+60000,purpose:'setup'});
   const results=await Promise.all(Array.from({length:8},()=>store.consumeInvite(token)));assert.equal(results.filter(Boolean).length,1);
   assert.equal((await cluster.admin.query('SELECT count(*)::int AS n FROM iway_uat_private.invites WHERE proof IS NOT NULL AND consumed IS NOT NULL')).rows[0].n,0);
  });
  await t.test('MFA handles, session epochs and rate windows persist across store recreation',async()=>{
   const cipher=createServerTokenCipher({key:randomBytes(32)}),first=createUatPostgresStore({pool:runtime,cipher}),second=createUatPostgresStore({pool:runtime,cipher});
   const entry=syntheticRoster[1],pending=randomBytes(32).toString('base64url'),version=(await first.state(entry.userId)).version;
   await first.saveMfa(pending,entry.userId,version,{accessToken:'synthetic-only'});assert.deepEqual((await second.consumeMfa(pending)).tokens,{accessToken:'synthetic-only'});assert.equal(await first.consumeMfa(pending),null);
   const values=await Promise.all(Array.from({length:10},()=>second.limit('shared-rate',3,60000)));assert.equal(values.filter(Boolean).length,3);
   const expired=randomBytes(32).toString('base64url');await first.saveInvite({token:expired,userId:entry.userId,proof:'synthetic-expired-proof',expires:Date.now()-1,purpose:'setup'});
   assert.ok(await second.recoverExpired());assert.equal(await first.consumeInvite(expired),null);
  });
  await t.test('privilege drift, column grants and broker-schema wrapper views fail readiness',async()=>{
   await cluster.admin.query('GRANT UPDATE(user_id) ON iway_uat_private.state TO iway_uat_runtime');
   try{await assert.rejects(assertUatPostgresRuntime(runtime),/PRIVILEGES_INVALID/);}finally{await cluster.admin.query('REVOKE UPDATE(user_id) ON iway_uat_private.state FROM iway_uat_runtime');}
   await cluster.admin.query('CREATE VIEW iway_uat_private.forbidden_wrapper AS SELECT * FROM operations_private.tenants; GRANT SELECT ON iway_uat_private.forbidden_wrapper TO iway_uat_runtime');
   try{await assert.rejects(assertUatPostgresRuntime(runtime),/PRIVILEGES_INVALID/);}finally{await cluster.admin.query('DROP VIEW iway_uat_private.forbidden_wrapper');}
   assert.equal(await assertUatPostgresRuntime(runtime),true);
  });
  await t.test('revocation cleanup cannot reactivate an account',async()=>{
   const userId=syntheticRoster[0].userId;await store.revoke(userId,{deactivate:true});await store.revoke(userId);
   assert.equal((await store.state(userId)).active,false);
  });
 }finally{if(runtime)await runtime.end();await cluster.cleanup();}
});
