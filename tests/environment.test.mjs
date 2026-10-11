import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir,cp,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {loadProjectEnv,environmentKeys} from '../scripts/load-env.mjs';
import {serverConfig} from '../server/config.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'iway-env-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return root;
}
const database=new URL('postgresql://database.example.invalid/registration');
database.username='iway_registration_login';database.password='synthetic-test-only';
const valid={DATABASE_URL:database.href,PGSSL:'require',IWAY_CONSENT_VERSION:'illustrative-test'};
test('dotenv quotes, comments and duplicate last-wins behavior are preserved',async t=>{
 const file=join(await fixture(t),'.env.local');
 await writeFile(file,'PORT=1111\nPORT=2222\nIWAY_CONSENT_VERSION=old\nIWAY_CONSENT_VERSION=\nDATABASE_URL="quoted#synthetic" # comment\n');
 const env={};loadProjectEnv({file,env});
 assert.deepEqual(env,{PORT:'2222',IWAY_CONSENT_VERSION:'',DATABASE_URL:'quoted#synthetic'});
});
test('deployment environment wins, including explicitly empty values',async t=>{
 const file=join(await fixture(t),'.env.local');await writeFile(file,'DATABASE_URL=file-value\nPGSSL=require\n');
 const env={DATABASE_URL:'deployment-value',PGSSL:''};loadProjectEnv({file,env});
 assert.deepEqual(env,{DATABASE_URL:'deployment-value',PGSSL:''});
});
test('missing env file is optional; unreadable env input fails without disclosing content',async t=>{
 const root=await fixture(t);const env={};loadProjectEnv({file:join(root,'absent'),env});assert.deepEqual(env,{});
 assert.throws(()=>loadProjectEnv({file:root,env}),/^Error: \.env\.local: INVALID$/);
});
test('unused administrative secrets and process flags are not loaded',async t=>{
 const file=join(await fixture(t),'.env.local');
 await writeFile(file,'SUPABASE_SERVICE_ROLE_KEY=synthetic\nSUPABASE_DB_PASSWORD=synthetic\nNODE_OPTIONS=synthetic\nNODE_TLS_REJECT_UNAUTHORIZED=0\nPORT=4173\n');
 const env={};loadProjectEnv({file,env});assert.deepEqual(env,{PORT:'4173'});
});
test('startup requires a dedicated login and rejects connection option overrides',()=>{
 for(const username of ['postgres','postgres.project','service_role','iway_registration']){
  const url=new URL(database);url.username=username;
  assert.throws(()=>serverConfig({...valid,DATABASE_URL:url.href}),/^Error: DATABASE_URL: INVALID$/);
 }
 const url=new URL(database);url.searchParams.set('sslmode','disable');
 assert.throws(()=>serverConfig({...valid,DATABASE_URL:url.href}),/DATABASE_URL: INVALID/);
 const configured=serverConfig(valid);assert.deepEqual(configured.postgres.ssl,{rejectUnauthorized:true});
});
test('startup fails closed for empty URLs, invalid TLS and missing consent',()=>{
 for(const value of ['', 'not-a-connection'])assert.throws(()=>serverConfig({...valid,DATABASE_URL:value}),/DATABASE_URL:/);
 for(const PGSSL of [undefined,'','false','disable'])assert.throws(()=>serverConfig({...valid,PGSSL}),/PGSSL:/);
 for(const IWAY_CONSENT_VERSION of [undefined,'','unapproved version','TBC'])assert.throws(()=>serverConfig({...valid,IWAY_CONSENT_VERSION}),/IWAY_CONSENT_VERSION:/);
 assert.throws(()=>serverConfig({NODE_ENV:'production'}),/DATABASE_URL: MISSING/);
});
test('loopback test databases retain their explicit non-TLS path',()=>{
 const url=new URL(database);url.hostname='127.0.0.1';
 assert.equal(serverConfig({...valid,DATABASE_URL:url.href,PGSSL:''}).postgres.ssl,false);
});
test('startup validates port without echoing its value',()=>{
 for(const PORT of ['','-1','65536','invalid'])assert.throws(()=>serverConfig({PORT}),/PORT: (EMPTY|INVALID)/);
 assert.equal(serverConfig({PORT:'0'}).port,0);
});
function run(file,cwd,extra={}){
 return new Promise((resolve,reject)=>{
  const env={...process.env};for(const key of environmentKeys)delete env[key];
  const child=spawn(process.execPath,[file],{cwd,env:{...env,...extra},stdio:['ignore','pipe','pipe']});
  let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('Fixture process timed out'))},10000);
  child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  child.on('error',e=>{clearTimeout(timer);reject(e)});
  child.on('exit',code=>{clearTimeout(timer);resolve({code,output})});
 });
}
async function copyEntrypoints(root){
 await cp(new URL('../server/',import.meta.url),join(root,'server'),{recursive:true});
 await mkdir(join(root,'scripts'));
 for(const name of ['load-env.mjs','certify-postgres.mjs','pg-certification-config.mjs']){
  await copyFile(new URL('../scripts/'+name,import.meta.url),join(root,'scripts',name));
 }
}
test('actual startup loads project env from another cwd and refuses invalid configuration before connecting',async t=>{
 const root=await fixture(t);await copyEntrypoints(root);
 await writeFile(join(root,'.env.local'),'DATABASE_URL=synthetic-invalid-secret\n');
 const result=await run(join(root,'server/start.mjs'),tmpdir());
 assert.equal(result.code,1);assert.equal(result.output.trim(),'DATABASE_URL: INVALID');
});
test('actual certification entrypoint loads project env and fails closed before a test process starts',async t=>{
 const root=await fixture(t);await copyEntrypoints(root);
 await writeFile(join(root,'.env.local'),'IWAY_PG_TEST_OPT_IN=1\n');
 // A small wrapper sets the requested mode while retaining the real entrypoint.
 await writeFile(join(root,'run.mjs'),"process.argv[2]='hosted';await import('./scripts/certify-postgres.mjs');");
 const result=await run(join(root,'run.mjs'),tmpdir());
 assert.equal(result.code,1);assert.match(result.output,/IWAY_PG_TEST_URL required/);
 assert.doesNotMatch(result.output,/OPT_IN=1 required|Running hosted|PASS/);
});
