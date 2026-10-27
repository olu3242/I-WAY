import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveUatRuntimeConfig,createUatCandidateRuntime} from '../server/operations-uat-runtime.mjs';
import {syntheticRoster} from './helpers/uat-fixture.mjs';
const env={VERCEL_ENV:'preview',IWAY_AUTH_ENABLED:'true',IWAY_AUTH_SCHEMA_APPROVED:'b512-v4',VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',IWAY_STAGING_VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',IWAY_AUTH_ORIGIN:'https://uat.illustrative.invalid',IWAY_AUTH_APPROVED_ORIGIN:'https://uat.illustrative.invalid',IWAY_AUTH_DATABASE_URL:'postgresql://iway_auth_runtime:synthetic@db.vnoxdinldneeczxibicp.supabase.co/postgres',IWAY_AUTH_PROVIDER:'google',IWAY_UAT_ENABLED:'true',IWAY_UAT_SCHEMA_APPROVED:'b574-candidate-v1',IWAY_UAT_DATABASE_URL:'postgresql://iway_uat_runtime:synthetic@db.vnoxdinldneeczxibicp.supabase.co/postgres'};
test('candidate requires genuine Preview, approved flags and separate restricted broker credentials',()=>{
 assert.equal(resolveUatRuntimeConfig(env).broker.ssl.rejectUnauthorized,true);
 for(const patch of [{VERCEL_ENV:'production'},{IWAY_UAT_ENABLED:'false'},{IWAY_UAT_SCHEMA_APPROVED:''},{IWAY_AUTH_PROVIDER:'github'},{IWAY_UAT_DATABASE_URL:env.IWAY_UAT_DATABASE_URL.replace('iway_uat_runtime','postgres')},{IWAY_UAT_DATABASE_URL:env.IWAY_UAT_DATABASE_URL+'?sslmode=disable'}])assert.throws(()=>resolveUatRuntimeConfig({...env,...patch}));
});
test('unresolved real identities and absent control-plane/relationship integrations fail before any pool starts',async()=>{
 await assert.rejects(createUatCandidateRuntime({env,roster:syntheticRoster}),/HOSTED_BINDINGS_REQUIRED/);
 await assert.rejects(createUatCandidateRuntime({env,roster:syntheticRoster.map(e=>({...e,userId:null}))}),/INCOMPLETE/);
});
