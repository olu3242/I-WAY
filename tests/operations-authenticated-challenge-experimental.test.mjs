import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedChallengeCustody} from '../server/operations-authenticated-challenge.experimental.mjs';
const id='invite',tenant='tenant';
const principal={verified:true,issuer:'https://issuer.test',subject:'sub',subjectHash:'a'.repeat(64)};
const invitation={id,tenantId:tenant,issuer:principal.issuer,subjectHash:principal.subjectHash,state:'VERIFIED',expiresAt:new Date(Date.now()+300000).toISOString()};
function fixture(overrides={}){
 let issued=0,stored;
 const custody=createAuthenticatedChallengeCustody({
  issueNonce:async()=>{issued++;return 'nonce-01234567890123456789';},
  storeNonce:async value=>{stored=value;},
  readNonce:async()=>stored?.nonce,
  verifySession:async token=>token==='valid'?principal:null,
  resolveInvitation:async()=>invitation,
  ...overrides
 });
 return {custody,issued:()=>issued};
}
test('verified session can issue and read bound challenge',async()=>{
 const {custody}=fixture();
 assert.deepEqual(await custody.issue({sessionToken:'valid',invitationId:id}),{nonce:'nonce-01234567890123456789'});
 assert.equal(await custody.read({sessionToken:'valid',invitationId:id,tenantId:tenant}),'nonce-01234567890123456789');
});
test('unauthenticated caller cannot issue or read challenge',async()=>{
 const {custody,issued}=fixture();
 await assert.rejects(custody.issue({sessionToken:'invalid',invitationId:id}),/DENIED/);
 assert.equal(await custody.read({sessionToken:'invalid',invitationId:id,tenantId:tenant}),null);
 assert.equal(issued(),0);
});
test('cross-tenant challenge read is rejected',async()=>{
 const {custody}=fixture();
 assert.equal(await custody.read({sessionToken:'valid',invitationId:id,tenantId:'other'}),null);
});
test('identity mismatch cannot issue challenge',async()=>{
 const {custody,issued}=fixture({resolveInvitation:async()=>({...invitation,subjectHash:'b'.repeat(64)})});
 await assert.rejects(custody.issue({sessionToken:'valid',invitationId:id}),/DENIED/);
 assert.equal(issued(),0);
});
test('revoked invitation cannot issue challenge',async()=>{
 const {custody}=fixture({resolveInvitation:async()=>({...invitation,state:'REVOKED'})});
 await assert.rejects(custody.issue({sessionToken:'valid',invitationId:id}),/DENIED/);
});

test('expired invitation cannot issue challenge',async()=>{
 const {custody}=fixture({resolveInvitation:async()=>({...invitation,expiresAt:new Date(Date.now()-1000).toISOString()})});
 await assert.rejects(custody.issue({sessionToken:'valid',invitationId:id}),/DENIED/);
});
test('missing expiry fails closed',async()=>{
 const {custody}=fixture({resolveInvitation:async()=>({...invitation,expiresAt:null})});
 await assert.rejects(custody.issue({sessionToken:'valid',invitationId:id}),/DENIED/);
});
