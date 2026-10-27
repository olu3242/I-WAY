import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createIdentityVerifier} from '../server/operations-identity.mjs';
import {createUatSupabaseProvider,createUatRecoveryIssuer} from '../server/operations-uat-provider.mjs';
const id='90000000-0000-4000-8000-000000000001',origin='https://vnoxdinldneeczxibicp.supabase.co';
function fixture(){
 const now=Date.now(),keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),requests=[];
 const verifier=createIdentityVerifier({issuer:origin+'/auth/v1',audience:'authenticated',requireMfa:false,keys:[{kid:'synthetic',algorithm:'ES256',publicKey:keys.publicKey}]});
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 function jwt(patch={}){const message=encode({alg:'ES256',kid:'synthetic',typ:'JWT'})+'.'+encode({iss:origin+'/auth/v1',aud:'authenticated',sub:id,aal:'aal1',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+300,...patch});return message+'.'+sign('sha256',Buffer.from(message),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}
 const user={id,email:'platform@illustrative.invalid',email_confirmed_at:new Date(now).toISOString(),is_anonymous:false,identities:[{provider:'google',user_id:id,id:'synthetic-google',identity_id:'90000000-0000-4000-8000-000000000081',identity_data:{sub:'synthetic-google'}}]};
 const makeTokens=()=>({access_token:jwt(),refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:300,user:{id}});
 const provider=createUatSupabaseProvider({apiKey:'synthetic-publishable',verifier,clock:()=>now,fetchImpl:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.endsWith('/user')?user:makeTokens()),{headers:{'content-type':'application/json'}});}});
 return {provider,user,jwt,requests,verifier,now};
}
test('password and setup use server-only Supabase contracts and cryptographically verified subjects',async()=>{
 const f=fixture();const result=await f.provider.passwordLogin({email:'platform@illustrative.invalid',password:'synthetic-password'});assert.equal(result.user.id,id);
 assert.equal(f.requests[0].url,origin+'/auth/v1/token?grant_type=password');assert.equal(f.requests[0].options.redirect,'error');
 assert.equal((await f.provider.inspect(result.accessToken)).googleSubjects[0],'synthetic-google');
 await f.provider.verifySetup('synthetic-recovery-hash');assert.deepEqual(JSON.parse(f.requests.find(r=>r.url.endsWith('/verify')).options.body),{type:'recovery',token_hash:'synthetic-recovery-hash'});
 await f.provider.setPassword(result.accessToken,'synthetic-new-password');assert.equal(f.requests.at(-1).options.method,'PUT');
 assert.equal(f.requests.at(-1).options.headers.authorization,'Bearer '+result.accessToken);
 assert.ok(f.requests.every(r=>!r.url.includes('password')||r.url.endsWith('grant_type=password')));
});
test('forged MFA, wrong issuer/audience, expired tokens, anonymous users and mismatched subjects deny',async()=>{
 const f=fixture();const good=f.jwt(),parts=good.split('.');parts[1]=Buffer.from(JSON.stringify({aal:'aal2',sub:id})).toString('base64url');
 for(const token of [parts.join('.'),f.jwt({iss:'https://other.invalid'}),f.jwt({aud:'service_role'}),f.jwt({exp:1})])await assert.rejects(f.provider.inspect(token));
 f.user.id='90000000-0000-4000-8000-000000000099';await assert.rejects(f.provider.inspect(good));
 f.user.id=id;f.user.is_anonymous=true;await assert.rejects(f.provider.inspect(good));
});
test('provider errors and oversized replies never expose request secrets',async()=>{
 const f=fixture();for(const mode of ['outage','oversized']){
  const provider=createUatSupabaseProvider({apiKey:'synthetic',verifier:f.verifier,fetchImpl:async()=>{if(mode==='outage')throw Error('synthetic-secret-password');return new Response(JSON.stringify({data:'x'.repeat(70000)}),{headers:{'content-type':'application/json'}});}});
  await assert.rejects(provider.passwordLogin({email:'synthetic@illustrative.invalid',password:'synthetic-secret-password'}),e=>e.message==='UAT_PROVIDER_UNAVAILABLE');
 }
});
test('control-plane recovery issuer rejects user mismatch and never creates accounts or emails',async()=>{
 let request;const issuer=createUatRecoveryIssuer({adminClient:{auth:{admin:{generateLink:async input=>{request=input;return {data:{user:{id},properties:{hashed_token:'synthetic-proof'}}};}}}}});
 assert.deepEqual(await issuer.generateRecovery({email:'platform@illustrative.invalid',userId:id}),{userId:id,tokenHash:'synthetic-proof'});assert.equal(request.type,'recovery');assert.equal(request.password,undefined);
 await assert.rejects(issuer.generateRecovery({email:'platform@illustrative.invalid',userId:'other'}),/ISSUER_UNAVAILABLE/);
});
test('documented Google subject id/sub binding rejects crossed identities and database UUID confusion',async()=>{
 const f=fixture(),token=f.jwt(),identity=structuredClone(f.user.identities[0]);assert.deepEqual((await f.provider.inspect(token)).googleSubjects,['synthetic-google']);
 for(const patch of [{id:identity.identity_id},{id:''},{user_id:'other-canonical-user'},{identity_data:{sub:'different-subject'}},{provider_id:'conflicting-provider-id'},{provider:'email'}]){
  f.user.identities=[{...identity,...patch}];assert.deepEqual((await f.provider.inspect(token)).googleSubjects,[]);
 }
 f.user.identities=[{...identity,provider_id:identity.id}];assert.deepEqual((await f.provider.inspect(token)).googleSubjects,['synthetic-google']);
});
test('owner TOTP setup is explicit, verified-subject-only and never replaces an existing factor',async()=>{
 const f=fixture(),requests=[],factor='90000000-0000-4000-8000-000000000085',challenge='90000000-0000-4000-8000-000000000086';
 const provider=createUatSupabaseProvider({apiKey:'synthetic',verifier:f.verifier,clock:()=>f.now,fetchImpl:async(url,options)=>{requests.push({url,options});const data=url.endsWith('/user')?f.user:url.endsWith('/factors')?{id:factor,type:'totp',totp:{secret:'ABCDEFGHIJKLMNOP'}}:{id:challenge};return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});}});
 await assert.rejects(provider.challengeMfa(f.jwt()),/ENROLLMENT_REQUIRED/);assert.ok(!requests.some(r=>r.url.endsWith('/factors')));
 const enrolled=await provider.challengeMfa(f.jwt(),{enroll:true});assert.equal(enrolled.enrollmentSecret,'ABCDEFGHIJKLMNOP');assert.equal(enrolled.factorId,factor);
 assert.deepEqual(JSON.parse(requests.find(r=>r.url.endsWith('/factors')).options.body),{factor_type:'totp',issuer:'I-WAY'});
 f.user.factors=[{id:factor,factor_type:'totp',status:'verified'}];requests.length=0;
 assert.equal((await provider.challengeMfa(f.jwt(),{enroll:true})).enrollmentSecret,undefined);assert.ok(!requests.some(r=>r.url.endsWith('/factors')));
});
