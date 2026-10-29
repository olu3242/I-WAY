import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSupabaseStagingConfig} from '../server/operations-supabase-staging-config.experimental.mjs';
const base={IWAY_SUPABASE_STAGE_ENABLED:'true',IWAY_SUPABASE_PROJECT_REF:'zolwjyhbfsxbdwyiwkbt',IWAY_SUPABASE_URL:'https://zolwjyhbfsxbdwyiwkbt.supabase.co',IWAY_SUPABASE_AUTH_REDIRECT:'https://qa.example.org/auth/callback',IWAY_SUPABASE_APPROVED_REDIRECT:'https://qa.example.org/auth/callback'};
test('B450 staging config must be explicitly enabled and project pinned',()=>{
 assert.throws(()=>resolveSupabaseStagingConfig({...base,IWAY_SUPABASE_STAGE_ENABLED:'false'}),/STAGING_DISABLED/);
 assert.throws(()=>resolveSupabaseStagingConfig({...base,IWAY_SUPABASE_PROJECT_REF:'other'}),/PROJECT_MISMATCH/);
 assert.equal(resolveSupabaseStagingConfig(base).allowedRedirects[0],base.IWAY_SUPABASE_AUTH_REDIRECT);
});
test('B450 rejects unapproved or unsafe callback destinations',()=>{
 for(const redirect of ['http://qa.example.org/auth/callback','https://localhost/auth/callback','https://qa.example.org/auth/callback?token=1','https://evil.example/auth/callback']){
  assert.throws(()=>resolveSupabaseStagingConfig({...base,IWAY_SUPABASE_AUTH_REDIRECT:redirect}),/REDIRECT/);
 }
});
