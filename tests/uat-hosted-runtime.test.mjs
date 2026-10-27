import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHostedOperationsConfig,createHostedUatRuntime} from '../server/operations-uat-hosted-runtime.mjs';
const project='vnoxdinldneeczxibicp',projectId='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
const url=role=>'postgresql://'+role+':synthetic-fixture-password@db.'+project+'.supabase.co:5432/postgres';
const base={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:projectId,IWAY_STAGING_VERCEL_PROJECT_ID:projectId,IWAY_AUTH_ENABLED:'true',IWAY_AUTH_SCHEMA_APPROVED:'b512-v4',IWAY_AUTH_ORIGIN:'https://fixture.example.invalid',IWAY_AUTH_APPROVED_ORIGIN:'https://fixture.example.invalid',IWAY_AUTH_DATABASE_URL:url('iway_auth_runtime'),IWAY_AUTH_PROVIDER:'google',IWAY_UAT_ENABLED:'true',IWAY_UAT_SCHEMA_APPROVED:'b574-candidate-v1',IWAY_UAT_DATABASE_URL:url('iway_uat_runtime'),IWAY_OPERATIONS_DATABASE_URL:url('iway_operations_runtime')};
test('B672 hosted Operations requires its own pinned restricted identity after genuine Preview gates',()=>{
 const config=resolveHostedOperationsConfig(base);assert.equal(config.expected.loginRole,'iway_operations_runtime');assert.equal(config.ssl.rejectUnauthorized,true);
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty'},{IWAY_UAT_ENABLED:'false'},{IWAY_AUTH_DATABASE_URL:url('postgres')},{IWAY_OPERATIONS_DATABASE_URL:undefined},{IWAY_OPERATIONS_DATABASE_URL:url('iway_auth_runtime')},{IWAY_OPERATIONS_DATABASE_URL:url('iway_uat_runtime')},{IWAY_OPERATIONS_DATABASE_URL:url('postgres')},{IWAY_OPERATIONS_DATABASE_URL:'postgresql://iway_operations_runtime:synthetic-fixture-password@db.otherproject.supabase.co:5432/postgres'}])assert.throws(()=>resolveHostedOperationsConfig({...base,...patch}));
});
test('B675 unavailable restricted database fails closed, closes pool and never reaches provider requests',async()=>{
 let closes=0,requests=0;
 class UnavailablePool{on(){}async connect(){throw Error('Synthetic database driver detail must remain private');}async end(){closes++;}}
 await assert.rejects(createHostedUatRuntime({env:base,PoolClass:UnavailablePool,fetchImpl:async()=>{requests++;throw Error('must not execute');}}),error=>error.message==='UAT_HOSTED_RUNTIME_UNAVAILABLE');
 assert.equal(closes,1);assert.equal(requests,0);
});
test('B675 missing Preview approval creates no pools or provider connections',async()=>{
 let pools=0,requests=0;class ForbiddenPool{constructor(){pools++;}}
 await assert.rejects(createHostedUatRuntime({env:{...base,VERCEL_ENV:'production'},PoolClass:ForbiddenPool,fetchImpl:async()=>{requests++;}}),/AUTH_STAGING_NOT_APPROVED/);
 assert.equal(pools,0);assert.equal(requests,0);
});
