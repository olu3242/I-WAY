// Explicit disposable PostgreSQL test. Never reads .env or contacts a linked project.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isolatedPostgres} from '../scripts/lib/isolated-postgres.mjs';
import {assertUatPostgresRuntime} from '../server/operations-uat-postgres.mjs';
const remediation=await readFile(new URL('../db/review-only/b631-broker-remediation.sql',import.meta.url),'utf8');
const verification=await readFile(new URL('../db/review-only/b631-broker-verify.sql',import.meta.url),'utf8');
test('B631 review-only broker remediation on disposable PostgreSQL',{timeout:120000},async t=>{
 assert.equal(process.env.IWAY_B631_LOCAL_OPT_IN,'true');
 const fixture=await isolatedPostgres({optIn:true});
 const admin=await fixture.admin.connect();let runtime;
 const apply=async()=>{try{await admin.query(remediation)}catch(e){await admin.query('ROLLBACK');throw e;}};
 try{
 await t.test('missing role fails closed and creates no schema',async()=>{
  await assert.rejects(apply(),/B631_BROKER_ROLE_MISSING/);
  assert.equal((await admin.query("SELECT to_regnamespace('iway_uat_private') AS schema")).rows[0].schema,null);
 });
 // Synthetic credential exists only in this disposable cluster. No real account provisioned.
 await admin.query("CREATE ROLE iway_uat_runtime LOGIN PASSWORD 'b631_disposable_fixture_only' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION");
 await t.test('unsafe role fails before installation',async()=>{
  await admin.query('ALTER ROLE iway_uat_runtime BYPASSRLS');
  try{await assert.rejects(apply(),/B631_BROKER_ROLE_UNSAFE/)}finally{await admin.query('ALTER ROLE iway_uat_runtime NOBYPASSRLS')}
 });
 await t.test('partial schema is rejected without destructive repair',async()=>{
  await admin.query('CREATE SCHEMA iway_uat_private');
  try{await assert.rejects(apply(),/B631_BROKER_SCHEMA_INCOMPLETE/)}finally{await admin.query('DROP SCHEMA iway_uat_private')}
 });
 await t.test('first application succeeds, second preserves existing state and metadata',async()=>{
  await apply();
  await admin.query("INSERT INTO iway_uat_private.state(user_id) VALUES ('00000000-0000-4000-8000-000000000631')");
  const before=await admin.query("SELECT oid FROM pg_class WHERE relnamespace='iway_uat_private'::regnamespace ORDER BY oid");
  await apply();
  assert.deepEqual((await admin.query("SELECT oid FROM pg_class WHERE relnamespace='iway_uat_private'::regnamespace ORDER BY oid")).rows,before.rows);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM iway_uat_private.state')).rows[0].n,1);
 });
 runtime=fixture.createPool({user:'iway_uat_runtime',password:'b631_disposable_fixture_only'});
 await t.test('genuine restricted identity passes runtime verification and cannot create principals',async()=>{
  assert.deepEqual((await runtime.query('SELECT session_user,current_user')).rows[0],{session_user:'iway_uat_runtime',current_user:'iway_uat_runtime'});
  assert.equal(await assertUatPostgresRuntime(runtime),true);
  for(const query of ['CREATE ROLE forbidden_b631','INSERT INTO iway_uat_private.state(user_id) VALUES(gen_random_uuid())','SELECT * FROM operations_private.tenants','SELECT * FROM iway_uat_private.audit'])await assert.rejects(runtime.query(query),e=>e.code==='42501');
 });
 await t.test('RLS drift is rejected without silently changing policies',async()=>{
  await admin.query('ALTER TABLE iway_uat_private.state NO FORCE ROW LEVEL SECURITY');
  try{await assert.rejects(apply(),/B631_BROKER_RLS_INVALID/)}finally{await admin.query('ALTER TABLE iway_uat_private.state FORCE ROW LEVEL SECURITY')}
 });
 await t.test('extra grants and permissive policies fail closed',async()=>{
  await admin.query('GRANT DELETE ON iway_uat_private.invites TO iway_uat_runtime');
  try{await assert.rejects(apply(),/B631_BROKER_GRANTS_INVALID/)}finally{await admin.query('REVOKE DELETE ON iway_uat_private.invites FROM iway_uat_runtime')}
  await admin.query('CREATE POLICY b631_forbidden ON iway_uat_private.state TO PUBLIC USING(true)');
  try{await assert.rejects(apply(),/B631_BROKER_POLICY_INVALID/)}finally{await admin.query('DROP POLICY b631_forbidden ON iway_uat_private.state')}
 });
 await t.test('column grants and unrelated data exposure are rejected',async()=>{
  await admin.query('GRANT INSERT(user_id) ON iway_uat_private.state TO iway_uat_runtime');
  try{await assert.rejects(apply(),/B631_BROKER_COLUMN_GRANTS_INVALID/)}finally{await admin.query('REVOKE INSERT(user_id) ON iway_uat_private.state FROM iway_uat_runtime')}
  await admin.query('GRANT USAGE ON SCHEMA operations_private TO iway_uat_runtime; GRANT SELECT ON operations_private.tenants TO iway_uat_runtime');
  try{await assert.rejects(apply(),/B631_BROKER_UNRELATED_EXPOSURE/)}finally{await admin.query('REVOKE SELECT ON operations_private.tenants FROM iway_uat_runtime; REVOKE USAGE ON SCHEMA operations_private FROM iway_uat_runtime')}
 });
 await t.test('column and constraint drift, schema and sequence exposure fail closed',async()=>{
  await admin.query('ALTER TABLE iway_uat_private.state ADD COLUMN forbidden text');
  try{await assert.rejects(apply(),/B631_BROKER_COLUMN_SHAPE_INVALID/)}finally{await admin.query('ALTER TABLE iway_uat_private.state DROP COLUMN forbidden')}
  await admin.query('ALTER TABLE iway_uat_private.state DROP CONSTRAINT state_version_check');
  try{await assert.rejects(apply(),/B631_BROKER_CONSTRAINT_INVALID/)}finally{await admin.query('ALTER TABLE iway_uat_private.state ADD CHECK(version>=0)')}
  await admin.query('GRANT USAGE ON SCHEMA iway_uat_private TO PUBLIC');
  try{await assert.rejects(apply(),/B631_BROKER_SCHEMA_EXPOSURE/)}finally{await admin.query('REVOKE USAGE ON SCHEMA iway_uat_private FROM PUBLIC')}
  await admin.query('GRANT SELECT ON SEQUENCE iway_uat_private.audit_id_seq TO iway_uat_runtime');
  try{await assert.rejects(apply(),/B631_BROKER_SEQUENCE_EXPOSURE/)}finally{await admin.query('REVOKE SELECT ON SEQUENCE iway_uat_private.audit_id_seq FROM iway_uat_runtime')}
 });
 await t.test('read-only verifier leaves state unchanged and runtime remains valid',async()=>{
  await admin.query('BEGIN READ ONLY');try{await admin.query(verification)}finally{await admin.query('ROLLBACK')}
  assert.equal(await assertUatPostgresRuntime(runtime),true);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM iway_uat_private.state')).rows[0].n,1);
 });
 }finally{admin.release();await fixture.cleanup()}
});
