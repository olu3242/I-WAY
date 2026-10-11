import test from 'node:test';
import assert from 'node:assert/strict';
import {certificationConfig} from '../scripts/pg-certification-config.mjs';
import {readFile} from 'node:fs/promises';
const connection=new URL('postgresql://localhost/certification');
connection.username='iway_registration_login';connection.password='illustrative-test-only';
const env={IWAY_PG_TEST_OPT_IN:'1',IWAY_PG_TEST_URL:connection.href,IWAY_PG_TEST_HOST:'localhost',IWAY_PG_TEST_CONSENT_VERSION:'illustrative-test'};
test('certification fails closed when opt-in or credentials are missing',()=>{
 for(const key of Object.keys(env))assert.throws(()=>certificationConfig('local',{...env,[key]:''}),/required/);
 assert.throws(()=>certificationConfig(undefined,env),/explicitly/);
});
test('local checks cannot be claimed as hosted certification',()=>{
 assert.equal(certificationConfig('local',env).ssl,false);
 assert.throws(()=>certificationConfig('hosted',env),/remote/);
});
test('rejects owner identity, wrong host, TLS overrides and invalid consent version',()=>{
 const owner=new URL(connection);owner.username='postgres';
 const insecure=new URL(connection);insecure.searchParams.set('sslmode','disable');
 for(const overrides of [{IWAY_PG_TEST_URL:owner.href},{IWAY_PG_TEST_HOST:'different.example.invalid'},
  {IWAY_PG_TEST_URL:insecure.href},{IWAY_PG_TEST_CONSENT_VERSION:'not approved'}]){
  assert.throws(()=>certificationConfig('local',{...env,...overrides}));
 }
});
test('startup connection probe never reads the private table',async()=>{
 const source=await readFile(new URL('../server/start.mjs',import.meta.url),'utf8');
 assert.match(source,/pool\.query\('SELECT 1'\)/);
 assert.doesNotMatch(source,/SELECT[^;]*early_access_leads/i);
});

test('hosted certification is pinned to the authorized Supabase project',()=>{
 const remote=new URL(connection);remote.hostname='db.vnoxdinldneeczxibicp.supabase.co';
 const configured={...env,IWAY_PG_TEST_URL:remote.href,IWAY_PG_TEST_HOST:remote.hostname};
 assert.equal(certificationConfig('hosted',configured).ssl.rejectUnauthorized,true);
 assert.match(certificationConfig('hosted',configured).ssl.ca,/BEGIN CERTIFICATE/);
 remote.hostname='db.another-project.supabase.co';
 assert.throws(()=>certificationConfig('hosted',{...configured,IWAY_PG_TEST_URL:remote.href,IWAY_PG_TEST_HOST:remote.hostname}),/authorized Supabase project/);
 remote.hostname='aws-0-us-east-1.pooler.supabase.com';remote.username='iway_registration_login.vnoxdinldneeczxibicp';
 assert.ok(certificationConfig('hosted',{...configured,IWAY_PG_TEST_URL:remote.href,IWAY_PG_TEST_HOST:remote.hostname}));
 remote.username='iway_registration_login.anotherproject';
 assert.throws(()=>certificationConfig('hosted',{...configured,IWAY_PG_TEST_URL:remote.href,IWAY_PG_TEST_HOST:remote.hostname}),/authorized Supabase project/);
});
test('certification rejects consent approval placeholders before connecting',()=>{
 for(const version of ['TBC','TODO','placeholder','YOUR_VERSION'])assert.throws(()=>certificationConfig('local',{...env,IWAY_PG_TEST_CONSENT_VERSION:version}),/Approved test consent version/);
});
