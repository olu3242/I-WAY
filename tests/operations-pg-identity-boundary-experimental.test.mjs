import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedInvitationAcceptor} from '../server/operations-pg-identity-boundary.experimental.mjs';
const subject='fixture-subject', issuer='https://idp.fixture.invalid';
const claims={issuer,subject,audience:'iway-fixture',verified:true,mfaVerified:true};
const args={id:'invitation',tenantId:'tenant',actorId:'actor',token:'fixture-token'};
function setup(verifyIdentity){
 const calls=[];
 const repository={async acceptVerified(input){calls.push(input);return {state:'ACCEPTED'};}};
 const acceptor=createVerifiedInvitationAcceptor({repository,verifyIdentity,expectedAudience:'iway-fixture',allowedIssuers:new Set([issuer])});
 return {acceptor,calls};
}
test('accepts only server-verified issuer and hashed subject',async()=>{
 const {acceptor,calls}=setup(async()=>claims);
 const result=await acceptor.accept({...args,verifiedIssuer:'spoofed',verifiedSubjectHash:'bad'});
 assert.equal(result.state,'ACCEPTED');
 assert.equal(calls.length,1);
 assert.equal(calls[0].verifiedIssuer,issuer);
 assert.equal(calls[0].verifiedSubjectHash,createHash('sha256').update(subject).digest('hex'));
});
for(const [name,override] of [
 ['untrusted issuer',{issuer:'https://attacker.invalid'}],
 ['wrong audience',{audience:'wrong'}],
 ['missing MFA',{mfaVerified:false}],
 ['unverified token',{verified:false}],
 ['missing subject',{subject:''}]
]){
 test('rejects '+name+' without persistence',async()=>{
  const {acceptor,calls}=setup(async()=>({...claims,...override}));
  await assert.rejects(acceptor.accept(args),/IDENTITY_PROOF_REJECTED/);
  assert.equal(calls.length,0);
 });
}
test('rejects verifier failure closed',async()=>{
 const {acceptor,calls}=setup(async()=>{throw Error('TOKEN_SIGNATURE_INVALID')});
 await assert.rejects(acceptor.accept(args),/TOKEN_SIGNATURE_INVALID/);
 assert.equal(calls.length,0);
});
test('rejects missing token before verifier invocation',async()=>{
 let invoked=false;
 const {acceptor,calls}=setup(async()=>{invoked=true;return claims});
 await assert.rejects(acceptor.accept({...args,token:''}),/IDENTITY_PROOF_REQUIRED/);
 assert.equal(invoked,false);assert.equal(calls.length,0);
});
