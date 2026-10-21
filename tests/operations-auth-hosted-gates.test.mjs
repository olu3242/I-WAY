import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedAuthConfig,runHostedAuth} from '../scripts/verify-hosted-auth.mjs';
test('hosted browser runner refuses absent approval and synthetic fixture configuration before launching',async()=>{
 let launches=0;await assert.rejects(runHostedAuth({env:{},chromium:{launch:async()=>{launches++;}}}),/HOSTED_AUTH_PREREQUISITES_MISSING/);assert.equal(launches,0);
 const env={IWAY_HOSTED_AUTH_APPROVED:'true',IWAY_HOSTED_SYNTHETIC_ONLY:'true',IWAY_AUTH_ORIGIN:'https://iway-auth-staging.vercel.app',
  IWAY_STAGING_VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',IWAY_HOSTED_COMMIT:'a'.repeat(40),
  IWAY_SYNTHETIC_OWN_RESOURCE:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',IWAY_SYNTHETIC_OTHER_RESOURCE:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
 assert.equal(hostedAuthConfig(env).origin,env.IWAY_AUTH_ORIGIN);
 for(const patch of [{IWAY_HOSTED_SYNTHETIC_ONLY:'false'},{IWAY_AUTH_ORIGIN:'https://iway.vercel.app'},
  {IWAY_HOSTED_COMMIT:'main'},{IWAY_STAGING_VERCEL_PROJECT_ID:'prj_0vutnbiNCYaxhdrbLfktrsHAvxty'},
  {IWAY_SYNTHETIC_OTHER_RESOURCE:env.IWAY_SYNTHETIC_OWN_RESOURCE}])assert.throws(()=>hostedAuthConfig({...env,...patch}));
});
