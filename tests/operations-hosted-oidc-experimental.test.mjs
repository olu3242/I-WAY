import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createHostedOidcVerifier} from '../server/operations-hosted-oidc.experimental.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const now=2000000000,issuer='https://identity.fixture.invalid',audience='iway-fixture';
const verifier=createHostedOidcVerifier({issuer,audience,jwks:{keys:[jwk]},clock:()=>now*1000,enabled:true});
const token=(claims={},header={})=>{
 const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-key',...header})).toString('base64url');
 const p=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub:'fixture-sub',iat:now-10,exp:now+300,nonce:'fixture-nonce',amr:['mfa'],...claims})).toString('base64url');
 const sig=sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');
 return h+'.'+p+'.'+sig;
};
test('disabled unless explicitly enabled',()=>assert.throws(()=>createHostedOidcVerifier({issuer,audience,jwks:{keys:[jwk]}}),/HOSTED_OIDC_DISABLED/));
test('accepts correctly signed issuer, audience, nonce and MFA',async()=>{
 const c=await verifier(token(),{nonce:'fixture-nonce'});
 assert.equal(c.verified,true);assert.equal(c.mfaVerified,true);assert.equal(c.subject,'fixture-sub');
});
for(const [name,claim] of [['issuer',{iss:'https://evil.invalid'}],['audience',{aud:'other'}],['expired',{exp:now-1}],['future nbf',{nbf:now+100}],['missing subject',{sub:''}]]){
 test('rejects '+name,async()=>assert.rejects(verifier(token(claim),{nonce:'fixture-nonce'}),/OIDC_TOKEN_REJECTED/));
}
test('rejects nonce mismatch',async()=>assert.rejects(verifier(token(),{nonce:'other'}),/OIDC_TOKEN_REJECTED/));
test('rejects signature tampering',async()=>{
 const parts=token().split('.');
 parts[1]=Buffer.from(JSON.stringify({sub:'attacker',iss:issuer,aud:audience,iat:now,exp:now+300,nonce:'fixture-nonce'})).toString('base64url');
 await assert.rejects(verifier(parts.join('.'),{nonce:'fixture-nonce'}),/OIDC_TOKEN_REJECTED/);
});
test('rejects algorithm confusion',async()=>assert.rejects(verifier(token({}, {alg:'none'}),{nonce:'fixture-nonce'}),/OIDC_TOKEN_REJECTED/));
