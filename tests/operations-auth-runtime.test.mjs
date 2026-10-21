import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveAuthRuntimeConfig,createAuthRuntime} from '../server/operations-auth-runtime.mjs';
import {packageAuthStaging} from '../scripts/package-auth-staging.mjs';
const valid={VERCEL_ENV:'preview',IWAY_AUTH_ENABLED:'true',IWAY_AUTH_SCHEMA_APPROVED:'b490-v2',
 VERCEL_PROJECT_ID:'prj_synthetic_isolated',IWAY_STAGING_VERCEL_PROJECT_ID:'prj_synthetic_isolated',
 IWAY_AUTH_ORIGIN:'https://synthetic.example.org',IWAY_AUTH_APPROVED_ORIGIN:'https://synthetic.example.org',
 IWAY_AUTH_DATABASE_URL:'postgresql://iway_auth_runtime:synthetic@db.vnoxdinldneeczxibicp.supabase.co:5432/postgres',
 IWAY_SESSION_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64url')};
test('runtime requires isolated preview, approved origin, pinned database and TLS',()=>{
 const result=resolveAuthRuntimeConfig(valid);assert.equal(result.db.ssl.rejectUnauthorized,true);assert.ok(result.db.ssl.ca);
 for(const patch of [{VERCEL_ENV:'production'},{IWAY_AUTH_ENABLED:'false'},{IWAY_AUTH_SCHEMA_APPROVED:''},
  {VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty',IWAY_STAGING_VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty'},
  {IWAY_AUTH_ORIGIN:'https://other.example.org'},{IWAY_AUTH_DATABASE_URL:valid.IWAY_AUTH_DATABASE_URL+'?sslmode=disable'},
  {IWAY_AUTH_DATABASE_URL:valid.IWAY_AUTH_DATABASE_URL.replace('iway_auth_runtime','postgres')},
  {IWAY_AUTH_DATABASE_URL:valid.IWAY_AUTH_DATABASE_URL.replace('vnoxdinldneeczxibicp','otherproject')}])assert.throws(()=>resolveAuthRuntimeConfig({...valid,...patch}));
});
test('runtime denies elevated roles and excessive table rights before accepting requests',async()=>{
 for(const elevated of [true,false]){
  let closed=false,calls=0;
  class Pool {on(){} async end(){closed=true;} async query(){calls++;return calls===1?{rows:[{name:'iway_auth_runtime',rolsuper:elevated,rolcanlogin:true}]}:
   {rowCount:5,rows:[{relrowsecurity:true,relforcerowsecurity:true,owns:false,excessive:true}]};}}
  await assert.rejects(createAuthRuntime({env:valid,PoolClass:Pool}),/AUTH_RUNTIME_UNAVAILABLE/);assert.equal(closed,true);assert.equal(calls,elevated?1:2);
 }
});
test('deploy package includes runtime dependencies and excludes private docs, requires empty output',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'iway-auth-package-'));const output=join(parent,'artifact');
 try{
  const files=await packageAuthStaging({output});assert.ok(files.includes('domain/authorization.mjs'));
  const names=await readdir(output);assert.deepEqual(names.sort(),['api','domain','package-lock.json','package.json','server','vercel.json']);
  const pkg=JSON.parse(await readFile(join(output,'package.json'),'utf8'));assert.deepEqual(Object.keys(pkg.dependencies),['pg']);
  const routes=JSON.parse(await readFile(join(output,'vercel.json'),'utf8'));assert.ok(routes.functions['api/index.mjs']);
  await writeFile(join(output,'unexpected.txt'),'synthetic');await assert.rejects(packageAuthStaging({output}),/PACKAGE_OUTPUT_MUST_BE_EMPTY/);
  const handler=(await import(pathToFileURL(join(output,'api/index.mjs')))).default;
  let body;const response={setHeader(){},end(s){body=s;}};await handler({},response);assert.equal(response.statusCode,503);assert.equal(body.includes('synthetic'),false);
 }finally{await rm(parent,{recursive:true,force:true});}
});
