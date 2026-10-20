import test from 'node:test';
import assert from 'node:assert/strict';
import {createEphemeralNonceStore} from '../server/operations-ephemeral-nonce-store.experimental.mjs';
const invitationId='invitation',tenantId='tenant',nonce='nonce-01234567890123456789';
test('stores only one active nonce and isolates tenant',async()=>{
 const store=createEphemeralNonceStore();
 await store.storeNonce({invitationId,tenantId,nonce});
 assert.equal(await store.readNonce({invitationId,tenantId}),nonce);
 assert.equal(await store.readNonce({invitationId,tenantId:'other'}),null);
 await assert.rejects(store.storeNonce({invitationId,tenantId,nonce:'different-012345678901234'}),/NONCE_ALREADY_STORED/);
});
test('clears nonce on explicit lifecycle cleanup',async()=>{
 const store=createEphemeralNonceStore();
 await store.storeNonce({invitationId,tenantId,nonce});
 await store.clearNonce({invitationId,tenantId});
 assert.equal(await store.readNonce({invitationId,tenantId}),null);
});
test('expired nonce is removed and can be replaced',async()=>{
 let now=1000;
 const store=createEphemeralNonceStore({clock:()=>now,ttlMs:1000});
 await store.storeNonce({invitationId,tenantId,nonce});
 now=2000;
 assert.equal(await store.readNonce({invitationId,tenantId}),null);
 await store.storeNonce({invitationId,tenantId,nonce:'replacement-012345678901234'});
 assert.equal(await store.readNonce({invitationId,tenantId}),'replacement-012345678901234');
});

test('B426 stale worker cannot clear nonce after fence takeover',async()=>{
 const store=createEphemeralNonceStore();
 await store.storeNonce({invitationId,tenantId,nonce});
 await store.setFence({invitationId,tenantId,ownerId:'worker-a',fenceToken:1});
 await store.setFence({invitationId,tenantId,ownerId:'worker-b',fenceToken:2});
 await assert.rejects(store.clearNonceFenced({invitationId,tenantId,ownerId:'worker-a',fenceToken:1}),/NONCE_FENCE_REJECTED/);
 assert.equal(await store.readNonce({invitationId,tenantId}),nonce);
 await assert.rejects(store.setFence({invitationId,tenantId,ownerId:'worker-a',fenceToken:1}),/NONCE_STALE_FENCE/);
 assert.equal(await store.clearNonceFenced({invitationId,tenantId,ownerId:'worker-b',fenceToken:2}),true);
 assert.equal(await store.readNonce({invitationId,tenantId}),null);
});
