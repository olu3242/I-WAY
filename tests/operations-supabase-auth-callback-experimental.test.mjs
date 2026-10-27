import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSupabaseAuthCallback} from '../server/operations-supabase-auth-callback.experimental.mjs';
const origin='https://qa.example.org';
test('B451 validates one code and matching state',()=>assert.deepEqual(parseSupabaseAuthCallback(origin+'/auth/callback?code=abc&state=xyz',{expectedOrigin:origin,expectedState:'xyz'}),{code:'abc'}));
test('B451 denies origin mismatch, state mismatch, fragments and URL tokens',()=>{
 for(const url of [origin+'/auth/callback?code=abc&state=bad',origin+'/auth/callback?code=abc&state=xyz#access_token=secret',origin+'/auth/callback?code=abc&state=xyz&refresh_token=x','https://evil.example/auth/callback?code=abc&state=xyz',origin+'/auth/callback?code=a&code=b&state=xyz']){
 assert.throws(()=>parseSupabaseAuthCallback(url,{expectedOrigin:origin,expectedState:'xyz'}),/AUTH_CALLBACK_/);
 }
});
