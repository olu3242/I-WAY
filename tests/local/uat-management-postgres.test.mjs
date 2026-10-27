// Disposable TLS cluster only; privileged provider and transport are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {Pool} from 'pg';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {createUatPostgresStore,assertUatPostgresRuntime} from '../../server/operations-uat-postgres.mjs';
import {createUatManagementPostgresStore,assertUatManagementRuntime} from '../../server/operations-uat-management-postgres.mjs';
import {createServerTokenCipher} from '../../server/operations-supabase-token-cipher.experimental.mjs';
import {createUatWorkflow} from '../../server/operations-uat-workflow.mjs';
import {createUatManagementPlane} from '../../server/operations-uat-management.mjs';
import {uatFixture,syntheticPassword,syntheticRoster} from '../helpers/uat-fixture.mjs';
import {managementFixture} from '../helpers/uat-management-fixture.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
test('B710 isolated PostgreSQL management issuance, RLS, idempotency, audit and real database restart',{timeout:180000},async t=>{
 assert.equal(process.env.IWAY_MANAGEMENT_LOCAL_OPT_IN,'true');const pg=await isolatedPostgres({optIn:true});
 const password=randomBytes(32).toString('hex'),cipher=createServerTokenCipher({key:randomBytes(32)});let brokerPool,managementPool;
 const open=()=>{
  brokerPool=new Pool({...pg.admin.options,user:'iway_uat_runtime',password,max:10});brokerPool.on('error',()=>{});
  managementPool=new Pool({...pg.admin.options,user:'iway_uat_management_runtime',password,max:10});managementPool.on('error',()=>{});
  return {broker:createUatPostgresStore({pool:brokerPool,cipher}),commands:createUatManagementPostgresStore({pool:managementPool})};
 };
 try{
  for(const name of ['iway_uat_runtime','iway_uat_management_runtime'])await pg.admin.query("CREATE ROLE "+name+" LOGIN PASSWORD '"+password+"' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION");
  for(const file of ['iway_uat_state_b574.sql','b710-uat-management.sql'])await pg.admin.query(await readFile(new URL('../../db/review-only/'+file,import.meta.url),'utf8'));
  for(const entry of syntheticRoster)await pg.admin.query('INSERT INTO iway_uat_private.state(user_id) VALUES($1)',[entry.userId]);
  let stores=open();
  await t.test('actual separate restricted TLS identities; RLS/FORCE RLS; no admin impersonation or business-table exposure',async()=>{
   assert.deepEqual((await managementPool.query('SELECT session_user,current_user')).rows[0],{session_user:'iway_uat_management_runtime',current_user:'iway_uat_management_runtime'});
   assert.equal(await assertUatManagementRuntime(managementPool),true);assert.equal(await assertUatPostgresRuntime(brokerPool),true);
   await assert.rejects(assertUatManagementRuntime(pg.admin));
   const tables=(await pg.admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_management_private' AND c.relkind='r'")).rows;
   assert.equal(tables.length,2);assert.ok(tables.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
   for(const sql of ['SELECT * FROM iway_uat_private.invites','SELECT * FROM operations_private.tenants','SELECT * FROM iway_uat_management_private.audit','CREATE TABLE iway_uat_management_private.forbidden(id int)','SET ROLE iway_fixture_admin'])await assert.rejects(managementPool.query(sql),e=>e.code==='42501');
  });
  for(const index of [0,1,2,3])await t.test(`real broker/management storage with synthetic ${syntheticRoster[index].role} provider lifecycle`,async()=>{
   const f=uatFixture();try{
    const dependencies={...f.dependencies,store:stores.broker},m=managementFixture(f,{commandStore:stores.commands,dependencies}),workflow=createUatWorkflow(dependencies),entry=syntheticRoster[index];
    const request={adminSession:'synthetic-approved-admin',userId:entry.userId,idempotencyKey:randomUUID()};
    const results=await Promise.allSettled(Array.from({length:8},()=>m.plane.issue(request)));assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(m.messages.length,1);assert.equal(m.generated,1);
    assert.equal((await m.plane.issue(request)).replayed,true);
    const activation=f.mail.at(-1).token;await workflow.setup({token:activation,password:syntheticPassword,network:'pg-management-setup'});await assert.rejects(workflow.setup({token:activation,password:syntheticPassword,network:'pg-management-replay'}));
    const initial=await workflow.passwordLogin({email:entry.email,password:syntheticPassword,network:'pg-management-login'});
    const session=initial.mfaRequired?await workflow.completeMfa({pending:initial.pending,code:'123456',network:'pg-management-mfa'}):initial;assert.equal((await workflow.session(session.id)).role,entry.role);
    await m.plane.issue({...request,purpose:'recovery',idempotencyKey:randomUUID()});assert.equal(await workflow.session(session.id),null);
    await workflow.setup({token:f.mail.at(-1).token,password:syntheticPassword,network:'pg-management-recovery'});
   }finally{f.db.close();}
  });
  const actorId='90000000-0000-4000-8000-000000000090',userId=syntheticRoster[3].userId;
  const row=()=>({key:hash(randomUUID()),fingerprint:hash('synthetic-management-operation'),actorId,userId,nonce:randomUUID(),now:Date.now(),expires:Date.now()+60000});
  await t.test('RLS hides other administrator rows; immutable columns, audit and terminal states cannot be changed',async()=>{
   assert.equal((await managementPool.query('SELECT * FROM iway_uat_management_private.commands')).rowCount,0);
   const c=await managementPool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('iway.management_actor',$1,true)",[randomUUID()]);assert.equal((await c.query('SELECT * FROM iway_uat_management_private.commands')).rowCount,0);await c.query('ROLLBACK');}finally{c.release();}
   for(const sql of ['UPDATE iway_uat_management_private.commands SET user_id=user_id','DELETE FROM iway_uat_management_private.commands','TRUNCATE iway_uat_management_private.audit','UPDATE iway_uat_management_private.audit SET event=event'])await assert.rejects(managementPool.query(sql),e=>e.code==='42501');
   await assert.rejects(pg.admin.query('UPDATE iway_uat_management_private.audit SET event=event'),/MANAGEMENT_AUDIT_IMMUTABLE/);
   await assert.rejects(pg.admin.query("UPDATE iway_uat_management_private.commands SET status='claimed',finished=NULL WHERE status='completed'"),/MANAGEMENT_COMMAND_IMMUTABLE/);
   for(const [grant,revoke] of [['GRANT SELECT(event) ON iway_uat_management_private.audit TO iway_uat_management_runtime','REVOKE SELECT(event) ON iway_uat_management_private.audit FROM iway_uat_management_runtime'],['GRANT UPDATE(nonce) ON iway_uat_management_private.commands TO iway_uat_management_runtime','REVOKE UPDATE(nonce) ON iway_uat_management_private.commands FROM iway_uat_management_runtime']]){
    await pg.admin.query(grant);try{await assert.rejects(assertUatManagementRuntime(managementPool));}finally{await pg.admin.query(revoke);}
   }
   assert.equal(await assertUatManagementRuntime(managementPool),true);
   await pg.admin.query('ALTER POLICY management_commands ON iway_uat_management_private.commands USING(true) WITH CHECK(true)');
   try{await assert.rejects(assertUatManagementRuntime(managementPool));}finally{await pg.admin.query("ALTER POLICY management_commands ON iway_uat_management_private.commands USING(actor_id::text=current_setting('iway.management_actor',true)) WITH CHECK(actor_id::text=current_setting('iway.management_actor',true))");}
   await pg.admin.query('ALTER TABLE iway_uat_management_private.audit DISABLE TRIGGER audit_immutable');
   try{await assert.rejects(assertUatManagementRuntime(managementPool));}finally{await pg.admin.query('ALTER TABLE iway_uat_management_private.audit ENABLE TRIGGER audit_immutable');}
   assert.equal(await assertUatManagementRuntime(managementPool),true);
  });
  await t.test('append-only audit failure rolls back command claim atomically',async()=>{
   await pg.admin.query("CREATE FUNCTION iway_uat_management_private.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit unavailable'; END $$; CREATE TRIGGER fixture_fail BEFORE INSERT ON iway_uat_management_private.audit FOR EACH ROW EXECUTE FUNCTION iway_uat_management_private.fixture_fail()");
   const input=row();try{await assert.rejects(stores.commands.claim(input));assert.equal((await pg.admin.query('SELECT 1 FROM iway_uat_management_private.commands WHERE key=$1',[input.key])).rowCount,0);}finally{await pg.admin.query('DROP TRIGGER fixture_fail ON iway_uat_management_private.audit; DROP FUNCTION iway_uat_management_private.fixture_fail()');}
  });
  let pending;
  await t.test('concurrent distinct keys for one target have one winner; expired/crashed claim is quarantined',async()=>{
   const inputs=Array.from({length:8},row),results=await Promise.all(inputs.map(x=>stores.commands.claim(x)));assert.equal(results.filter(r=>r.status==='claimed').length,1);
   const i=results.findIndex(r=>r.status==='claimed');pending=inputs[i];
   assert.equal((await stores.commands.claim({...pending,now:pending.expires+1})).status,'fenced');
   assert.equal((await pg.admin.query('SELECT status FROM iway_uat_management_private.commands WHERE key=$1',[pending.key])).rows[0].status,'uncertain');
  });
  await t.test('actual PostgreSQL server restart preserves completed idempotency, uncertainty fences, encrypted broker state and append-only audit',async()=>{
   const before=(await pg.admin.query('SELECT count(*)::int AS n FROM iway_uat_management_private.audit')).rows[0].n;
   const completed=(await pg.admin.query("SELECT * FROM iway_uat_management_private.commands WHERE status='completed' LIMIT 1")).rows[0];
   await brokerPool.end();await managementPool.end();brokerPool=null;managementPool=null;
   await pg.restartDatabase();stores=open();
   assert.equal(await assertUatManagementRuntime(managementPool),true);assert.equal(await assertUatPostgresRuntime(brokerPool),true);
   assert.equal((await stores.commands.claim({key:completed.key,fingerprint:completed.fingerprint,actorId:completed.actor_id,userId:completed.user_id,nonce:randomUUID(),expires:Date.now()+60000,now:Date.now()})).status,'completed');
   assert.equal((await stores.commands.claim(row())).status,'fenced');
   assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM iway_uat_management_private.audit')).rows[0].n,before);
   assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM iway_uat_private.state WHERE ready')).rows[0].n,4);
   assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM iway_uat_private.invites WHERE consumed IS NOT NULL AND proof IS NOT NULL')).rows[0].n,0);
  });
 }finally{if(brokerPool)await brokerPool.end();if(managementPool)await managementPool.end();await pg.cleanup();}
});
