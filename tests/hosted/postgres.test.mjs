import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {makeApp} from '../../server/app.mjs';
import {registerPgLead} from '../../server/pg-lead-store.mjs';
import {Pool} from 'pg';
import {certificationConfig} from '../../scripts/pg-certification-config.mjs';
const config=certificationConfig(process.env.IWAY_PG_TEST_MODE);
const mode=process.env.IWAY_PG_TEST_MODE;
const table='iway_private.early_access_leads';
// Deliberately no mocks, skip branches, owner connection, or cleanup DELETE.
test(mode+' PostgreSQL registration certification',{timeout:90000},async t=>{
 const pool=new Pool({...config,max:1,connectionTimeoutMillis:10000,query_timeout:10000});
 let server;
 let identityVerified=false;
 t.after(async()=>{if(server)await stop(server.child);await pool.end()});
 async function query(sql,params){
  try{return await pool.query(sql,params)}catch(e){
   // PostgreSQL errors can contain row data; never propagate detail or raw messages.
   throw Object.assign(new Error('Database operation failed; SQLSTATE '+(/^[A-Z0-9]{5}$/.test(e.code)?e.code:'unavailable')),{code:e.code});
  }
 }
 await t.test('dedicated identity, restricted membership, RLS and insert-only ACLs',async()=>{
  const {rows:[r]}=await query(`SELECT current_user AS identity, session_user AS login,
   rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication
   FROM pg_roles WHERE rolname=current_user`);
  assert.equal(r.identity,'iway_registration_login');assert.equal(r.login,r.identity);
  for(const key of ['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication'])assert.equal(r[key],false,key);
  const {rows:members}=await query(`SELECT parent.rolname, m.admin_option,m.inherit_option,m.set_option
   FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
   WHERE m.member=current_user::regrole`);
  assert.deepEqual(members,[{rolname:'iway_registration',admin_option:false,inherit_option:true,set_option:false}]);
  const {rows:[role]}=await query("SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname='iway_registration'");
  assert.ok(role);
  for(const value of Object.values(role))assert.equal(value,false);
  const {rows:parents}=await query("SELECT 1 FROM pg_auth_members WHERE member='iway_registration'::regrole");
  assert.equal(parents.length,0);
  const {rows:[state]}=await query(`SELECT relrowsecurity,
   relowner IN (current_user::regrole,'iway_registration'::regrole) AS owns_table
   FROM pg_class WHERE oid=$1::regclass`,[table]);
  assert.equal(state.relrowsecurity,true);assert.equal(state.owns_table,false);
  for(const privilege of ['SELECT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
   const {rows:[p]}=await query('SELECT has_table_privilege(current_user,$1,$2) AS allowed',[table,privilege]);
   assert.equal(p.allowed,false,privilege);
  }
  for(const privilege of ['SELECT','UPDATE']){
   const {rows:[p]}=await query('SELECT has_any_column_privilege(current_user,$1,$2) AS allowed',[table,privilege]);
   assert.equal(p.allowed,false,privilege+' columns');
  }
  const {rows:[allowed]}=await query('SELECT has_table_privilege(current_user,$1,$2) AS insert',[table,'INSERT']);
  assert.equal(allowed.insert,true);
  const {rows:[schema]}=await query("SELECT has_schema_privilege(current_user,'iway_private','USAGE') AS usage, has_schema_privilege(current_user,'iway_private','CREATE') AS create");
  assert.equal(schema.usage,true);assert.equal(schema.create,false);
  for(const role of ['anon','authenticated']){
   const {rows:[p]}=await query(`SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege($1,$2,'SELECT,INSERT,UPDATE,REFERENCES')
    OR has_schema_privilege($1,'iway_private','USAGE,CREATE') AS allowed`,[role,table]);
   assert.equal(p.allowed,false,'Public API role must have no private access');
  }
  const {rows:[publicAcl]}=await query(`SELECT
   (SELECT count(*) FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid=$1::regclass AND a.grantee=0)
   + (SELECT count(*) FROM pg_namespace n, LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    WHERE n.nspname='iway_private' AND a.grantee=0)
   + (SELECT count(*) FROM pg_attribute att,LATERAL aclexplode(att.attacl) a
    WHERE att.attrelid=$1::regclass AND a.grantee=0) AS grants`,[table]);
  assert.equal(Number(publicAcl.grants),0,'PUBLIC must have no private grants');
  identityVerified=true;
 });
 assert.ok(identityVerified,'Refusing writes because database identity checks failed');
 const lead={name:'Illustrative Certification',email:'iway-cert-'+randomUUID()+'@example.invalid',company:'Illustrative test data',role:'driver',consent:true};
 await t.test('actual startup and successful HTTP insert',async()=>{
  server=await start();assert.equal((await fetch(server.url+'/api/health')).status,200);
  assert.equal((await post(server.url,lead)).status,201);
 });
 await t.test('normalized duplicate returns 200',async()=>{
  assert.ok(server);assert.equal((await post(server.url,{...lead,email:' '+lead.email.toUpperCase()+' '})).status,200);
 });
 await t.test('invalid HTTP consent returns 400 and stores no row',async()=>{
  assert.ok(server);const invalid={...lead,email:'iway-cert-'+randomUUID()+'@example.invalid'};
  assert.equal((await post(server.url,{...invalid,consent:false})).status,400);
  assert.equal((await post(server.url,invalid)).status,201);
 });
 await t.test('database also rejects false consent',async()=>{
  const email='iway-cert-'+randomUUID()+'@example.invalid';
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   let code;
   try{await client.query(`INSERT INTO iway_private.early_access_leads
    (id,name,email,email_hash,company,role,consent,consent_version)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),lead.name,email,createHash('sha256').update(email).digest('hex'),'Illustrative test data','driver',false,config.consentVersion])}
   catch(e){code=e.code}
   assert.ok(['23514','42501'].includes(code),'Consent must fail at CHECK or RLS');
  }finally{await client.query('ROLLBACK');client.release()}
 });
 for(const [operation,sql] of [
  ['SELECT','SELECT * FROM iway_private.early_access_leads LIMIT 0'],
  ['UPDATE',"UPDATE iway_private.early_access_leads SET name='Illustrative' WHERE false"],
  ['DELETE','DELETE FROM iway_private.early_access_leads WHERE false']
 ])await t.test(operation+' is denied (SQLSTATE 42501)',async()=>{
  // No real row is read or modified, even if permissions regress.
  await assert.rejects(query(sql),e=>e.code==='42501');
 });
 await t.test('unavailable connection pool returns 503 without recording a lead',async()=>{
  const unavailable=new Pool({...config,max:1,connectionTimeoutMillis:10000});
  try{await unavailable.query('SELECT 1')}finally{await unavailable.end()}
  const app=makeApp({register:input=>registerPgLead(unavailable,input,{consentVersion:config.consentVersion})});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  const candidate={...lead,email:'iway-cert-'+randomUUID()+'@example.invalid'};
  try{
   const response=await fetch('http://127.0.0.1:'+app.address().port+'/api/early-access',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(candidate),signal:AbortSignal.timeout(10000)});
   assert.equal(response.status,503);
   assert.deepEqual(await response.json(),{error:'Registration unavailable'});
   assert.equal((await post(server.url,candidate)).status,201);
  }finally{await new Promise(resolve=>app.close(resolve))}
 });
 await t.test('committed registration persists after application process restart',async()=>{
  assert.ok(server);await stop(server.child);server=undefined;
  server=await start();
  assert.equal((await post(server.url,lead)).status,200);
  assert.equal((await post(server.url,{...lead,email:'iway-cert-'+randomUUID()+'@example.invalid'})).status,201);
 });
});
async function post(url,lead){
 const response=await fetch(url+'/api/early-access',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(lead),signal:AbortSignal.timeout(10000)});
 const body=await response.json();
 if(response.status===200||response.status===201)assert.deepEqual(body,{status:'received'});
 return response;
}
function start(){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['server/start.mjs'],{stdio:['ignore','pipe','pipe'],env:{
   ...process.env,NODE_ENV:'production',PORT:'0',DATABASE_URL:config.connectionString,
   IWAY_CONSENT_VERSION:config.consentVersion,PGSSL:mode==='hosted'?'require':''
  }});
  const timer=setTimeout(()=>fail(),15000);
  let output='';
  function fail(){clearTimeout(timer);child.kill();reject(new Error('Registration server failed to start (output redacted)'))}
  child.once('error',fail);child.once('exit',fail);
  child.stderr.on('data',()=>{}); // Discard potentially sensitive driver errors.
  child.stdout.on('data',chunk=>{
   output=(output+chunk.toString()).slice(-2000);
   const match=output.match(/I-way listening on port (\d+)/);
   if(match){clearTimeout(timer);child.removeListener('exit',fail);resolve({child,url:'http://127.0.0.1:'+match[1]})}
  });
 });
}
async function stop(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 await new Promise(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);resolve()});child.kill('SIGTERM')});
}
