import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {buildOperationsPgConfig,AsyncOperationsPgStore,operationsPostgresReadiness} from '../server/operations-postgres.mjs';

const expected={projectRef:'vnoxdinldneeczxibicp',endpoint:'aws-1-us-west-2.pooler.supabase.com',databaseName:'postgres',loginRole:'iway_operations_fixture'};
const options=()=>({...expected,databaseUrl:'postgresql://'+expected.loginRole+'.'+expected.projectRef+':illustrative-test-password@'+expected.endpoint+':5432/postgres'});
const scope=()=>({tenantId:randomUUID(),actorId:randomUUID()});
function harness({health={},query,parameters={},stream={},connectError,principal=true}={}){
 const config=buildOperationsPgConfig(options()),calls=[],released=[];
 const client={
  connectionParameters:{host:expected.endpoint,port:5432,database:'postgres',user:expected.loginRole+'.'+expected.projectRef,ssl:config.ssl,...parameters},
  connection:{stream:{encrypted:true,authorized:true,getPeerCertificate:()=>({subjectaltname:'DNS:'+expected.endpoint}),...stream}},
  async query(sql,values){
   calls.push({sql,values});
   if(query){const override=await query(sql,values);if(override!==undefined)return override;}
   if(sql.startsWith('SELECT current_user'))return {rows:[{login:expected.loginRole,database:'postgres',rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,elevated_membership:false,owns_operations:false,ssl:true,...health}],rowCount:1};
   if(sql.startsWith('SELECT id FROM operations_private.users'))return {rows:principal?[{id:values[1]}]:[],rowCount:principal?1:0};
   if(sql.startsWith('INSERT INTO operations_private.resources'))return {rows:[{data:JSON.parse(values[3])}],rowCount:1};
   if(sql.startsWith('SELECT data FROM operations_private.resources'))return {rows:[],rowCount:0};
   return {rows:[],rowCount:0};
  },
  release(discard){released.push(discard)}
 };
 const pool={async connect(){if(connectError)throw connectError;return client}};
 return {store:new AsyncOperationsPgStore(pool,{config}),calls,released,client,config};
}
test('offline readiness never claims live PostgreSQL, RLS execution or synchronous engine integration',()=>{
 assert.equal(operationsPostgresReadiness.hostedConnectionExecuted,false);
 assert.equal(operationsPostgresReadiness.migrationApplied,false);
 assert.equal(operationsPostgresReadiness.rlsExecution,'BLOCKED');
 assert.equal(operationsPostgresReadiness.engineIntegration,'BLOCKED');
});
test('operations configuration requires an explicit dedicated role, verified endpoint and strict immutable TLS',()=>{
 const config=buildOperationsPgConfig(options());
 assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.expected.loginRole,expected.loginRole);
 assert.ok(Object.isFrozen(config)&&Object.isFrozen(config.ssl));
 assert.equal(Object.hasOwn(config.ssl,'checkServerIdentity'),false);
 for(const patch of [
  {loginRole:'postgres'},{loginRole:'iway_registration_login'},{databaseUrl:options().databaseUrl.replace(':5432',':6543')},
  {databaseUrl:options().databaseUrl+'?sslmode=no-verify'},{databaseUrl:options().databaseUrl+'#fragment'},
  {databaseUrl:options().databaseUrl.replace(expected.projectRef,'wrongproject')},
  {endpoint:'unapproved.invalid'},{databaseName:'another_database'}
 ])assert.throws(()=>buildOperationsPgConfig({...options(),...patch}),e=>e.code==='CONFIGURATION'&&!e.message.includes('illustrative-test-password'));
 assert.throws(()=>new AsyncOperationsPgStore({connect(){}},{config:{...config}}),e=>e.code==='CONFIGURATION');
});
test('health checks role, server TLS and certificate hostname without private table reads',async()=>{
 const h=harness();assert.deepEqual(await h.store.health(),{identityVerified:true,tlsVerified:true,restrictedRole:true});
 assert.equal(h.released[0],false);assert.equal(h.calls.length,1);assert.match(h.calls[0].sql,/pg_catalog\.pg_roles/);
 assert.doesNotMatch(h.calls[0].sql,/FROM operations_private/);
});
test('health fails closed for role escalation, owner privileges, identities and TLS failures',async()=>{
 for(const patch of [{rolsuper:true},{rolbypassrls:true},{rolcreaterole:true},{rolcreatedb:true},{rolreplication:true},{elevated_membership:true},{owns_operations:true},{login:'postgres'},{ssl:false}]){
  const h=harness({health:patch});await assert.rejects(()=>h.store.health());assert.deepEqual(h.released,[true]);
 }
 for(const extra of [{stream:{authorized:false}},{stream:{encrypted:false}},{stream:{getPeerCertificate:()=>({subjectaltname:'DNS:wrong.invalid'})}},{parameters:{ssl:{rejectUnauthorized:false}}},{parameters:{user:'postgres'}}]){
  const h=harness(extra);await assert.rejects(()=>h.store.health());assert.deepEqual(h.released,[true]);assert.equal(h.calls.length,0);
 }
});
test('transaction uses one client, BEGIN then parameterized transaction-local context and authenticated tenant principal',async()=>{
 const h=harness(),context=scope(),foreign=scope().tenantId,resourceId=randomUUID();let escaped;
 const result=await h.store.transaction(context,async tx=>{
  escaped=tx;
  assert.deepEqual(await tx.list('load'),[]);
  assert.throws(()=>tx.query('DROP TABLE ignored'));
  return tx.insert('load',{id:resourceId,customer:'Illustrative customer'});
 });
 assert.equal(result.tenantId,context.tenantId);
 const txCalls=h.calls.slice(1);assert.equal(txCalls[0].sql,'BEGIN');assert.match(txCalls[1].sql,/set_config\('iway.tenant_id',\$1,true\)/);
 assert.deepEqual(txCalls[1].values,[context.tenantId,context.actorId,'5000','2000']);
 assert.equal(txCalls.at(-1).sql,'COMMIT');assert.deepEqual(h.released,[false]);
 assert.ok(txCalls.filter(c=>c.values).every(c=>c.values[0]===context.tenantId));
 assert.ok(!h.calls.some(c=>c.sql.includes(context.tenantId)||c.sql.includes(context.actorId)));
 await assert.rejects(()=>escaped.list('load'),e=>e.code==='TRANSACTION_CLOSED');
 await assert.rejects(()=>h.store.transaction(context,tx=>tx.insert('load',{tenantId:foreign})),e=>e.code==='OWNERSHIP');
});
test('tenant context is rebound for every reused connection and inactive or cross-tenant principal rolls back',async()=>{
 const h=harness(),a=scope(),b=scope();await h.store.transaction(a,tx=>tx.list('load'));await h.store.transaction(b,tx=>tx.list('load'));
 const contexts=h.calls.filter(c=>c.sql.startsWith('SELECT set_config'));assert.deepEqual(contexts.map(c=>c.values.slice(0,2)),[[a.tenantId,a.actorId],[b.tenantId,b.actorId]]);
 const bad=harness({principal:false});await assert.rejects(()=>bad.store.transaction(a,()=>assert.fail('unauthorized work ran')),e=>e.code==='AUTHORIZATION');
 assert.equal(bad.calls.at(-1).sql,'ROLLBACK');assert.deepEqual(bad.released,[false]);
});
test('query, callback, context setup and commit failures roll back and sanitize driver details',async()=>{
 const marker='ILLUSTRATIVE_SECRET_NOT_FOR_LOGS';
 for(const failure of ['SELECT data FROM operations_private.resources','SELECT set_config','COMMIT','callback']){
  const h=harness({query(sql){if(sql.startsWith(failure))throw Object.assign(new Error(marker),{code:'42501'});}});
  await assert.rejects(()=>h.store.transaction(scope(),async tx=>{if(failure==='callback')throw new Error(marker);return tx.list('load')}),e=>!e.message.includes(marker));
  assert.equal(h.calls.at(-1).sql,'ROLLBACK');assert.deepEqual(h.released,[false]);
 }
});
test('failed rollback or BEGIN destroys the client and connect failure has no leaked client',async()=>{
 for(const failure of ['BEGIN','ROLLBACK']){
  const h=harness({query(sql){if(sql===failure)throw new Error('private-driver-detail')}});
  await assert.rejects(()=>h.store.transaction(scope(),()=>{throw new Error('callback-failure')}));
  assert.deepEqual(h.released,[true]);
 }
 const h=harness({connectError:Object.assign(new Error('sensitive connection details'),{code:'28P01'})});
 await assert.rejects(()=>h.store.transaction(scope(),()=>{}),e=>e.code==='AUTHENTICATION'&&!e.message.includes('sensitive'));assert.equal(h.released.length,0);
});
test('an unawaited statement is drained before commit and cannot conceal a database failure',async()=>{
 const h=harness({async query(sql){if(sql.startsWith('SELECT data FROM operations_private.resources')){await new Promise(resolve=>setTimeout(resolve,10));throw Object.assign(new Error('private'),{code:'42501'})}}});
 await assert.rejects(()=>h.store.transaction(scope(),tx=>{tx.list('load').catch(()=>{});return 'done'}),e=>e.code==='AUTHORIZATION');
 assert.equal(h.calls.at(-1).sql,'ROLLBACK');assert.ok(!h.calls.some(c=>c.sql==='COMMIT'));
});
test('optimistic writes and bounded reads remain parameterized with immutable ownership fields',async()=>{
 const h=harness(),id=randomUUID();
 await assert.rejects(()=>h.store.transaction(scope(),tx=>tx.update('load',id,1,{status:'validated'})),e=>e.code==='STALE');
 const update=h.calls.find(c=>c.sql.startsWith('UPDATE operations_private.resources'));assert.match(update.sql,/tenant_id=\$1.*version=\$4/);assert.equal(update.values[4],'{"status":"validated"}');
 for(const patch of [{id},{tenantId:id},{kind:'invoice'},{version:99}]){
  await assert.rejects(()=>h.store.transaction(scope(),tx=>tx.update('load',id,1,patch)),e=>e.code==='OWNERSHIP');
 }
 await assert.rejects(()=>h.store.transaction(scope(),tx=>tx.list('load',{limit:501})),e=>e.code==='INPUT');
 await assert.rejects(()=>h.store.transaction(scope(),tx=>tx.list("load'; DROP TABLE users;")),e=>e.code==='INPUT');
});
test('audit is bounded metadata and client supplied private payloads are rejected',async()=>{
 const h=harness();
 await assert.rejects(()=>h.store.transaction(scope(),tx=>tx.audit({action:'load:update',detail:{paymentReference:'forbidden'}})),e=>e.code==='AUDIT_METADATA');
 assert.ok(!h.calls.some(c=>c.sql.startsWith('INSERT INTO operations_private.audit')));
});
test('offline migration contains explicit forced RLS per table, tenant USING and WITH CHECK, immutable evidence and no application grants',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261011174100_operations_persistence_readiness.sql',import.meta.url),'utf8');
 for(const table of ['tenants','users','sessions','resources','commands','audit']){
  assert.ok(sql.includes('ALTER TABLE operations_private.'+table+' ENABLE ROW LEVEL SECURITY'));
  assert.ok(sql.includes('ALTER TABLE operations_private.'+table+' FORCE ROW LEVEL SECURITY'));
  assert.match(sql,new RegExp('CREATE POLICY '+table+'_tenant_read[^;]+USING'));
  assert.match(sql,new RegExp('CREATE POLICY '+table+'_tenant_insert[^;]+WITH CHECK'));
 }
 assert.match(sql,/resources_tenant_update[^;]+USING[^;]+WITH CHECK/);
 assert.match(sql,/operations_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE/);
 assert.match(sql,/FOREIGN KEY\(tenant_id,user_id\)/);
 const statements=sql.replace(/--[^\n]*/g,'');
 assert.doesNotMatch(statements,/\bGRANT\b|\bSECURITY DEFINER\b|\bCREATE ROLE\b/i);
 assert.match(statements,/REVOKE ALL ON SCHEMA operations_private FROM PUBLIC/);
 assert.doesNotMatch(statements,/\bCREATE POLICY[^;]+FOR DELETE/i);
});

test('tenant serialization precedes principal verification and protected work',async()=>{
 const h=harness(),context=scope();await h.store.transaction(context,tx=>tx.list('load'));
 const lock=h.calls.findIndex(c=>c.sql.includes('pg_advisory_xact_lock'));
 const principal=h.calls.findIndex(c=>c.sql.startsWith('SELECT id FROM operations_private.users'));
 assert.ok(lock>0&&lock<principal);assert.deepEqual(h.calls[lock].values,[context.tenantId]);
});

test('typed async authorization and replay errors survive adapter rollback without driver details',async()=>{
 const {AsyncCommandError}=await import('../domain/operations-async-command.mjs');
 for(const code of ['FORBIDDEN','IDEMPOTENCY_CONFLICT','INVALID_DISPATCHER']){
  const h=harness();await assert.rejects(h.store.transaction(scope(),()=>{throw new AsyncCommandError(code)}),{code});
  assert.equal(h.calls.at(-1).sql,'ROLLBACK');
 }
});

test('actor evidence policies bind commands, audit insert and sessions to authenticated actor',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261011220000_operations_actor_evidence.sql',import.meta.url),'utf8');
 for(const policy of ['commands_actor','audit_actor_insert','sessions_actor'])assert.match(sql,new RegExp('CREATE POLICY '+policy+'[^;]+AS RESTRICTIVE[^;]+WITH CHECK'));
 assert.doesNotMatch(sql,/SECURITY DEFINER|GRANT|DROP POLICY/i);
});

test('dispatcher lookup uses only the tenant-scoped minimal directory projection',async()=>{
 const h=harness(),context=scope(),id=randomUUID();await h.store.transaction(context,tx=>tx.user(id));
 const call=h.calls.find(c=>c.sql.includes('FROM operations_private.dispatcher_directory'));
 assert.deepEqual(call.values,[context.tenantId,id]);assert.doesNotMatch(call.sql,/password|username/);
 const sql=readFileSync(new URL('../supabase/migrations/20261011221000_operations_dispatcher_directory.sql',import.meta.url),'utf8');
 assert.match(sql,/FORCE ROW LEVEL SECURITY/);assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/data->>'role'='carrier'/);assert.match(sql,/data->'permissions' \? 'load:create'/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|DROP POLICY|GRANT /i);
});
