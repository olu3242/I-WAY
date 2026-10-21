import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createConfiguredSessionCipher,assertPrivateAuthStorageReady} from '../server/operations-supabase-session-config.experimental.mjs';
test('B463 rejects missing, malformed and short session keys',()=>{
 for(const env of [{},{IWAY_SESSION_ENCRYPTION_KEY:'invalid'},{IWAY_SESSION_ENCRYPTION_KEY:randomBytes(16).toString('base64url')}])
  assert.throws(()=>createConfiguredSessionCipher(env),/IWAY_SESSION_ENCRYPTION_KEY_INVALID/);
});
test('B463 accepts server-only 256-bit key and requires storage dependencies',()=>{
 const key=randomBytes(32).toString('base64url');
 const cipher=createConfiguredSessionCipher({IWAY_SESSION_ENCRYPTION_KEY:key});
 assert.equal(cipher.decrypt(cipher.encrypt('secret')),'secret');
 assert.throws(()=>assertPrivateAuthStorageReady({cipher}),/PRIVATE_AUTH_STORAGE_NOT_CONFIGURED/);
 assert.equal(assertPrivateAuthStorageReady({cipher,query:async()=>({})}),true);
});
