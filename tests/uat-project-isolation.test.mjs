import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {uatProject,uatOrigin} from '../server/operations-uat-target.mjs';
import {connectionConfig} from '../scripts/staging-connection-probe.mjs';
import {createSupabaseProvider} from '../server/operations-supabase-provider.mjs';
import {resolveUatManagementDatabaseConfig} from '../server/operations-uat-management-postgres.mjs';
test('B951 public waitlist cannot be selected as UAT database by any runtime role',()=>{
 assert.equal(uatProject,'zolwjyhbfsxbdwyiwkbt');
 for(const kind of ['AUTH','UAT','OPERATIONS'])for(const host of ['db.vnoxdinldneeczxibicp.supabase.co','aws-0-us-east-1.pooler.supabase.com']){
  const user='iway_'+kind.toLowerCase()+'_runtime'+(host.startsWith('aws-')?'.vnoxdinldneeczxibicp':'');
  assert.throws(()=>connectionConfig('postgresql://'+user+':synthetic-test-password@'+host+':5432/postgres',kind));
 }
 assert.throws(()=>resolveUatManagementDatabaseConfig('postgresql://iway_uat_management_runtime:synthetic-test-password@db.vnoxdinldneeczxibicp.supabase.co:5432/postgres'));
});
test('B951 OAuth adapter rejects public waitlist origin before making any network request',()=>{
 let calls=0;assert.throws(()=>createSupabaseProvider({url:'https://vnoxdinldneeczxibicp.supabase.co',apiKey:'synthetic',provider:'google',redirectTo:'https://uat.example.invalid/auth/callback',fetchImpl:()=>{calls++}}));assert.equal(calls,0);
 assert.ok(createSupabaseProvider({url:uatOrigin,apiKey:'synthetic',provider:'google',redirectTo:'https://uat.example.invalid/auth/callback'}));
});
test('B951 active runtime and management adapters have no public waitlist pin',()=>{
 for(const path of ['operations-auth-runtime.mjs','operations-supabase-provider.mjs','operations-uat-runtime.mjs','operations-uat-hosted-runtime.mjs','operations-uat-provider.mjs','operations-uat-jwks.mjs','operations-uat-management.mjs','operations-uat-management-postgres.mjs'])assert.ok(!readFileSync(new URL('../server/'+path,import.meta.url),'utf8').includes('vnoxdinldneeczxibicp'),path);
});
