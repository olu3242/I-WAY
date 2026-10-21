import test from 'node:test';
import assert from 'node:assert/strict';
import {createPkceTransaction,assertPkceState,pkceTransactionCookie,sessionCookie,clearSessionCookie} from '../server/operations-supabase-pkce-session.experimental.mjs';
test('B453 PKCE creates unpredictable verifier/state and S256 challenge',()=>{
 const a=createPkceTransaction(),b=createPkceTransaction();
 assert.notEqual(a.state,b.state);assert.notEqual(a.verifier,b.verifier);assert.notEqual(a.verifier,a.challenge);
 assert.equal(a.method,'S256');assertPkceState(a.state,a.state);
 assert.throws(()=>assertPkceState(a.state,b.state),/PKCE_STATE_MISMATCH/);
});
test('B453 cookies require Secure HttpOnly host-only SameSite policy',()=>{
 const cookie=pkceTransactionCookie({value:createPkceTransaction().state});
 assert.match(cookie,/__Host-iway-pkce=/);assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(cookie,/Domain=/);
 assert.match(sessionCookie({value:'x'.repeat(48)}),/Max-Age=3600/);
 assert.match(clearSessionCookie(),/Max-Age=0/);
 assert.throws(()=>sessionCookie({value:'short'}),/SESSION_COOKIE_INVALID/);
});
