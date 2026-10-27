import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {assessStagingOnboarding} from '../scripts/lib/staging-onboarding-preflight.mjs';
function fixture(){
 const project='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',tenant=randomUUID(),fleet=randomUUID();
 const configuration={platformNamespaceId:randomUUID(),roster:Object.entries({platform:'oadeyemo306@gmail.com',carrier:'martin@tm88investments.com',fleet:'info@tm88investments.com',driver:'cassiomey@gmail.com'}).map(([role,email])=>({role,email,userId:randomUUID(),principalId:randomUUID(),googleSubject:'synthetic-'+randomUUID(),permissions:[],tenantId:role==='platform'?null:tenant,fleetId:['fleet','driver'].includes(role)?fleet:null}))};
 const key={...generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'}),kid:'synthetic',alg:'ES256'};
 return {env:{VERCEL_ENV:'preview',VERCEL_PROJECT_ID:project,IWAY_STAGING_VERCEL_PROJECT_ID:project,IWAY_AUTH_ENABLED:'true',IWAY_UAT_ENABLED:'true'},pool:{query:async()=>({rows:[{configuration}]})},engine:{validatePlatformNamespace:async()=>true,verifyUatEntry:async()=>true},fetchImpl:async()=>new Response(JSON.stringify({keys:[key]}),{headers:{'content-type':'application/json'}})};
}
test('onboarding probe rejects wrong target before any network or database access',async()=>{
 const f=fixture();f.env.VERCEL_ENV='production';f.pool.query=f.fetchImpl=()=>assert.fail('must not access dependencies');
 assert.deepEqual((await assessStagingOnboarding(f)).checks,[{check:'target',status:'BLOCKED'}]);
});
test('onboarding probe independently reports disabled activation and missing binding without exposing identity or driver detail',async()=>{
 const f=fixture();delete f.env.IWAY_AUTH_ENABLED;delete f.env.IWAY_UAT_ENABLED;f.pool.query=async()=>{throw Error('private connection detail');};f.engine.verifyUatEntry=()=>assert.fail('no binding');
 const r=await assessStagingOnboarding(f);assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.check==='publicSigningKeys').status,'PASS');assert.equal(r.checks.find(c=>c.check==='activeTenantRelationships').status,'NOT_RUN');
 assert.doesNotMatch(JSON.stringify(r),/private connection|@|synthetic-/);
});
test('onboarding probe requires every active relationship and rejects unavailable public keys',async()=>{
 const f=fixture();let n=0;f.engine.verifyUatEntry=async()=>++n<4;f.fetchImpl=async()=>{throw Error('secret detail');};
 const r=await assessStagingOnboarding(f);assert.equal(n,4);assert.equal(r.status,'BLOCKED');assert.equal(r.checks.find(c=>c.check==='activeTenantRelationships').status,'BLOCKED');assert.equal(r.checks.find(c=>c.check==='publicSigningKeys').status,'BLOCKED');
});
test('passing onboarding prerequisites never claims hosted login or tenant workflow certification',async()=>{
 const r=await assessStagingOnboarding(fixture());assert.equal(r.status,'PASS_PREREQUISITES_ONLY');assert.equal(r.hostedCertified,false);assert.equal(r.tenantWorkflow,'NOT_RUN');assert.equal(r.checks.length,5);
});
