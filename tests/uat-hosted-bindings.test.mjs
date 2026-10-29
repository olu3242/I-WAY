import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {loadHostedUatBindings} from '../server/operations-uat-hosted-bindings.mjs';
import {loadHostedUatVerifier} from '../server/operations-uat-jwks.mjs';
const issuer='https://zolwjyhbfsxbdwyiwkbt.supabase.co/auth/v1';
function synthetic(){
 const tenantId=randomUUID(),fleetId=randomUUID();
 return {platformNamespaceId:randomUUID(),roster:Object.entries({platform:'oadeyemo306@gmail.com',carrier:'martin@tm88investments.com',fleet:'info@tm88investments.com',driver:'cassiomey@gmail.com'}).map(([role,email])=>({role,email,userId:randomUUID(),principalId:randomUUID(),googleSubject:'synthetic-google-'+randomUUID(),permissions:[],tenantId:role==='platform'?null:tenantId,fleetId:['fleet','driver'].includes(role)?fleetId:null}))};
}
test('B669 hosted bindings require exact approved four-email roles and actual owner-seeded hierarchy',async()=>{
 const config=synthetic();let observed;
 const pool={query:async(sql,args)=>{observed={sql,args};return {rows:[{configuration:config}]};}};
 const result=await loadHostedUatBindings({pool});assert.equal(result.platformNamespaceId,config.platformNamespaceId);assert.equal(result.roster.length,4);assert.ok(Object.isFrozen(result.roster));
 assert.deepEqual(observed.args,['prj_7uof3CdmN1QvzKxETkXvHjlrLjVm']);assert.match(observed.sql,/approved=true/);
});
test('B669 missing, unapproved, duplicate and mismatched membership bindings fail closed without IDs in errors',async()=>{
 const samples=[null,synthetic(),synthetic(),synthetic(),synthetic()];
 samples[1].roster[0].email='unapproved@example.invalid';samples[2].roster[2].tenantId=randomUUID();samples[3].roster[3].fleetId=randomUUID();samples[4].roster[0].tenantId=samples[4].platformNamespaceId;
 for(const config of samples){await assert.rejects(loadHostedUatBindings({pool:{query:async()=>({rows:config?[{configuration:config}]:[]})}}),error=>error.message==='UAT_APPROVED_DEPLOYMENT_BINDINGS_REQUIRED');}
 await assert.rejects(loadHostedUatBindings({pool:{query:async()=>{throw Error('driver detail must not escape');}}}),error=>error.message==='UAT_APPROVED_DEPLOYMENT_BINDINGS_REQUIRED');
});
test('B668 hosted verifier fetches pinned public JWKS and verifies asymmetric AAL1/AAL2 identity proofs',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk={...publicKey.export({format:'jwk'}),alg:'ES256',kid:'synthetic-test-key',use:'sig'};let observed;
 const verifier=await loadHostedUatVerifier({fetchImpl:async(url,options)=>{observed={url,options};return new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});}});
 assert.equal(observed.url,issuer+'/.well-known/jwks.json');assert.equal(observed.options.redirect,'error');assert.equal(observed.options.headers.authorization,undefined);
 const now=Math.floor(Date.now()/1000);
 for(const aal of ['aal1','aal2']){
  const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256',kid:jwk.kid})).toString('base64url'),claims=Buffer.from(JSON.stringify({iss:issuer,aud:'authenticated',sub:randomUUID(),iat:now,exp:now+600,aal})).toString('base64url'),unsigned=header+'.'+claims;
  const jwt=unsigned+'.'+sign('sha256',Buffer.from(unsigned),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');assert.equal(verifier.verify(jwt).assurance,aal);
 }
});
test('B668 hosted verifier rejects shared/private signing keys, wrong content, oversized bodies and network errors',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),base={...publicKey.export({format:'jwk'}),alg:'ES256',kid:'test',use:'sig'};
 for(const keys of [[],[{kty:'oct',k:'never-a-shared-secret',alg:'HS256',kid:'legacy'}],[{...privateKey.export({format:'jwk'}),alg:'ES256',kid:'private'}],[{...base,use:'enc'}],[{...base,key_ops:['sign']}],[base,base]]){
  await assert.rejects(loadHostedUatVerifier({fetchImpl:async()=>new Response(JSON.stringify({keys}),{headers:{'content-type':'application/json'}})}),error=>error.message==='UAT_PUBLIC_SIGNING_KEYS_UNAVAILABLE');
 }
 for(const response of [new Response('not json',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}}),new Response('{}',{status:503,headers:{'content-type':'application/json'}})])await assert.rejects(loadHostedUatVerifier({fetchImpl:async()=>response}),/PUBLIC_SIGNING_KEYS_UNAVAILABLE/);
 await assert.rejects(loadHostedUatVerifier({fetchImpl:async()=>{throw Error('network details must not escape');}}),error=>error.message==='UAT_PUBLIC_SIGNING_KEYS_UNAVAILABLE');
});
