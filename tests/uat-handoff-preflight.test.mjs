import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoffPreflight,requiredUatNames,validateUatEnvironment,uatEnvironmentContract} from '../scripts/uat-handoff-preflight.mjs';
import {randomBytes} from 'node:crypto';
const validEnvironment=()=>({
 VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',
 IWAY_STAGING_VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',IWAY_AUTH_ENABLED:'true',IWAY_AUTH_SCHEMA_APPROVED:'b512-v4',
 IWAY_AUTH_ORIGIN:'https://synthetic-uat.invalid',IWAY_AUTH_APPROVED_ORIGIN:'https://synthetic-uat.invalid',IWAY_AUTH_PROVIDER:'google',
 IWAY_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_public_fixture_only',IWAY_SESSION_ENCRYPTION_KEY:randomBytes(32).toString('base64url'),
 IWAY_UAT_ENABLED:'true',IWAY_UAT_SCHEMA_APPROVED:'b574-candidate-v1',
 ...Object.fromEntries(['AUTH','UAT','OPERATIONS'].map(name=>['IWAY_'+name+'_DATABASE_URL','postgresql://iway_'+name.toLowerCase()+'_runtime:synthetic_fixture_only@db.vnoxdinldneeczxibicp.supabase.co:5432/postgres']))
});
test('all thirteen Preview contracts validate offline without disclosing configuration values',()=>{
 const env=validEnvironment(),result=validateUatEnvironment(env);
 assert.equal(result.status,'PASS_OFFLINE_CONFIGURATION_ONLY');assert.equal(result.networkRequests,0);assert.equal(result.hostedCertified,false);
 assert.deepEqual(uatEnvironmentContract.map(x=>x.name),requiredUatNames);
 const serialized=JSON.stringify(result);for(const value of Object.values(env))assert.ok(!serialized.includes(value));
 for(const name of requiredUatNames){const copy={...env};delete copy[name];assert.equal(validateUatEnvironment(copy).status,'BLOCKED',name);}
});
test('Production targets, public projects, origin injection and runtime identity substitutions fail offline',()=>{
 const env=validEnvironment();
 for(const patch of [
  {VERCEL_ENV:'production'},{VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty'},
  {IWAY_AUTH_ORIGIN:'https://user:password@synthetic-uat.invalid'},{IWAY_AUTH_APPROVED_ORIGIN:'https://other.invalid'},
  {IWAY_AUTH_ORIGIN:'https://synthetic-uat.invalid/callback'},{IWAY_AUTH_PROVIDER:'github'},
  {IWAY_SESSION_ENCRYPTION_KEY:'invalid-sensitive-marker'},
  ...['AUTH','UAT','OPERATIONS'].map(name=>({['IWAY_'+name+'_DATABASE_URL']:env['IWAY_'+name+'_DATABASE_URL'].replace('iway_'+name.toLowerCase()+'_runtime','postgres')})),
  ...['AUTH','UAT','OPERATIONS'].map(name=>({['IWAY_'+name+'_DATABASE_URL']:env['IWAY_'+name+'_DATABASE_URL']+'?sslmode=disable'}))
 ]){const result=validateUatEnvironment({...env,...patch});assert.equal(result.status,'BLOCKED');assert.ok(!JSON.stringify(result).includes('invalid-sensitive-marker'));}
});
test('secret API credentials are rejected while pinned anon compatibility keys remain explicitly public',()=>{
 const env=validEnvironment(),jwt=role=>'e30.'+Buffer.from(JSON.stringify({role,ref:'vnoxdinldneeczxibicp'})).toString('base64url')+'.synthetic';
 assert.equal(validateUatEnvironment({...env,IWAY_SUPABASE_PUBLISHABLE_KEY:jwt('anon')}).status,'PASS_OFFLINE_CONFIGURATION_ONLY');
 for(const key of ['sb_secret_synthetic_private_fixture',jwt('service_role'),'invalid-sensitive-marker']){
  const result=validateUatEnvironment({...env,IWAY_SUPABASE_PUBLISHABLE_KEY:key});assert.ok(result.issues.includes('PUBLISHABLE_API_KEY_INVALID'));assert.ok(!JSON.stringify(result).includes(key));
 }
});
test('real provisioning remains blocked and preflight emits names without supplied secret values',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../docs/security/uat-provisioning-manifest.json',import.meta.url)));
 const result=handoffPreflight({env:{DATABASE_URL:'sensitive-marker'},manifest});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,13);assert.equal(result.runtimeLogin.auth,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.equal(result.runtimeLogin.operations,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.ok(!JSON.stringify(result).includes('sensitive-marker'));
});

test('legacy twelve-key configuration cannot omit the separate Operations runtime credential',()=>{
 const legacy=requiredUatNames.filter(n=>n!=='IWAY_OPERATIONS_DATABASE_URL');
 const env=Object.fromEntries(legacy.map(n=>[n,'synthetic-private-marker']));
 const result=handoffPreflight({env,previewNames:legacy,manifest:{testers:[]}});
 assert.equal(result.status,'BLOCKED');assert.deepEqual(result.missingLocal,['IWAY_OPERATIONS_DATABASE_URL']);assert.deepEqual(result.missingPreview,['IWAY_OPERATIONS_DATABASE_URL']);
 assert.equal(result.runtimeLogin.operations,'BLOCKED_MISSING_RESTRICTED_CREDENTIAL');assert.ok(!JSON.stringify(result).includes('synthetic-private-marker'));
});
test('matching variable names alone cannot certify identity provisioning or hosted access',()=>{
 const result=handoffPreflight({env:Object.fromEntries(requiredUatNames.map(n=>[n,'synthetic'])),previewNames:requiredUatNames,manifest:{testers:[]}});
 assert.equal(result.status,'BLOCKED');assert.equal(result.missingPreview.length,0);
});

test('blank runtime credentials remain missing in both name and login reports',()=>{
 const env={IWAY_AUTH_DATABASE_URL:' ',IWAY_UAT_DATABASE_URL:'\t',IWAY_OPERATIONS_DATABASE_URL:''};
 const result=handoffPreflight({env,manifest:{testers:[]}});
 assert.ok(Object.keys(env).every(n=>result.missingLocal.includes(n)));
 assert.ok(Object.values(result.runtimeLogin).every(s=>s==='BLOCKED_MISSING_RESTRICTED_CREDENTIAL'));
});
