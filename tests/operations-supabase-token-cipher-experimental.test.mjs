import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServerTokenCipher} from '../server/operations-supabase-token-cipher.experimental.mjs';
test('B457 token cipher encrypts, authenticates and uses unique nonce',()=>{
 const cipher=createServerTokenCipher({key:randomBytes(32)});
 const a=cipher.encrypt('secret-refresh-token'),b=cipher.encrypt('secret-refresh-token');
 assert.notEqual(a,b);assert.ok(!a.includes('secret-refresh-token'));
 assert.equal(cipher.decrypt(a),'secret-refresh-token');
 assert.equal(cipher.decrypt(b),'secret-refresh-token');
 const parts=a.split('.');parts[3]=parts[3].slice(0,-1)+(parts[3].endsWith('A')?'B':'A');
 assert.throws(()=>cipher.decrypt(parts.join('.')),/TOKEN_CIPHERTEXT_INVALID/);
});
test('B457 rejects absent keys and invalid ciphertext',()=>{
 assert.throws(()=>createServerTokenCipher({key:randomBytes(16)}),/TOKEN_ENCRYPTION_KEY_REQUIRED/);
 const cipher=createServerTokenCipher({key:randomBytes(32)});
 assert.throws(()=>cipher.decrypt('plain-token'),/TOKEN_CIPHERTEXT_INVALID/);
});
