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
