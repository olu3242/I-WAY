// B401 isolated HTTP -> verified proof -> PostgreSQL provisioning.
// Test-only fixture: no live identity provider, no production HTTP wiring.
import {Client} from 'pg';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createHostedOidcVerifier} from '../server/operations-hosted-oidc.experimental.mjs';
import {once} from 'node:events';
import {createPgNonceChallenges} from '../server/operations-pg-nonce-challenges.experimental.mjs';
import {createPgProvisioner} from '../server/operations-pg-provisioning.experimental.mjs';
import {createVerifiedProvisioningFlow} from '../server/operations-pg-verified-provisioning.experimental.mjs';
import {createIsolatedOnboardingHttpServer} from '../server/operations-onboarding-http.experimental.mjs';
import {createPgInvitationContextResolver} from '../server/operations-pg-invitation-context.experimental.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const invitationId='a1010101-0101-4101-8101-010101010101';
const tenantId='a2020202-0202-4202-8202-020202020202';
const actorId='a3030303-0303-4303-8303-030303030303';
const issuer='https://identity.fixture.invalid',subject='b401-subject';
const nonce='b401-server-challenge';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'b401-test-key',alg:'RS256',use:'sig'};
const now=Math.floor(Date.now()/1000);
const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:jwk.kid})).toString('base64url');
const payload=Buffer.from(JSON.stringify({iss:issuer,aud:'iway-fixture',sub:subject,iat:now-10,exp:now+300,nonce,amr:['mfa']})).toString('base64url');
const signClaims=claims=>{
 const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');
 return header+'.'+encoded+'.'+sign('RSA-SHA256',Buffer.from(header+'.'+encoded),privateKey).toString('base64url');
};
const claims={iss:issuer,aud:'iway-fixture',sub:subject,iat:now-10,exp:now+300,nonce,amr:['mfa']};
const token=signClaims(claims);
const client=new Client();
await client.connect();
const transaction=async fn=>{
 await client.query('BEGIN');
 try{const result=await fn(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}
};
let server;
try{
 await client.query(`INSERT INTO operations_onboarding.invitations
 (id,tenant_id,creator_id,recipient,assignment,issuer,subject_hash,state,expires_at)
 VALUES($1,$2,$3,'b401@example.invalid','{"role":"driver"}',$4,$5,'VERIFIED',now()+interval '1 hour')`,
 [invitationId,tenantId,actorId,issuer,digest(subject)]);
 await client.query(`INSERT INTO operations_onboarding.identity_nonce_challenges
 (nonce_hash,invitation_id,tenant_id,expires_at)
 VALUES($1,$2,$3,now()+interval '5 minutes')`,[digest(nonce),invitationId,tenantId]);
 const nonceRepo=createPgNonceChallenges(transaction);
 const provisioner=createPgProvisioner(transaction,{consumeNonce:nonceRepo.consume});
 const verifiedProvisioning=createVerifiedProvisioningFlow({
  provisioner,expectedAudience:'iway-fixture',allowedIssuers:new Set([issuer]),
  verifyIdentity:createHostedOidcVerifier({issuer,audience:'iway-fixture',jwks:{keys:[jwk]},enabled:true})
 });
 const resolveInvitationContext=createPgInvitationContextResolver({
  query:(sql,params)=>client.query(sql,params),
  resolveNonce:async({invitationId:requested,tenantId:requestedTenant})=>
   requested===invitationId&&requestedTenant===tenantId?nonce:null
 });
 server=createIsolatedOnboardingHttpServer({verifiedProvisioning,resolveInvitationContext});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port+'/experimental/onboarding/provision';
 const body={invitationId,tenantId,actorId,role:'driver',token,expectedNonce:nonce};
 const post=async data=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 const expired=await post({...body,token:signClaims({...claims,exp:now-1})});
 if(expired.status!==403)throw Error('B402_EXPIRED_TOKEN_ALLOWED');
 const wrongAudience=await post({...body,token:signClaims({...claims,aud:'untrusted-client'})});
 if(wrongAudience.status!==403)throw Error('B402_WRONG_AUDIENCE_ALLOWED');
 const elevatedRole=await post({...body,role:'platform'});
 if(elevatedRole.status!==200)throw Error('B403_CLIENT_ROLE_OVERRIDE_CHANGED_TRUSTED_ROLE');
 const success=elevatedRole;
 if((await success.json()).state!=='ACTIVE')throw Error('B401_HTTP_ACTIVATION_FAILED');
 const forged=await post({...body,token:token.slice(0,-2)+'xx'});
 if(forged.status!==403)throw Error('B402_FORGED_SIGNATURE_ALLOWED');
 const wrongNonce=await post({...body,expectedNonce:'attacker-nonce'});
 if(wrongNonce.status!==403)throw Error('B402_NONCE_MISMATCH_ALLOWED');
 const replay=await post(body);
 if(replay.status!==403)throw Error('B401_REPLAY_ALLOWED');
 const otherTenant=await post({...body,invitationId:'a4040404-0404-4404-8404-040404040404'});
 if(otherTenant.status!==403)throw Error('B401_CROSS_TENANT_ALLOWED');
 const state=await client.query('SELECT state FROM operations_onboarding.invitations WHERE id=$1',[invitationId]);
 const bindings=await client.query('SELECT count(*)::int AS n FROM operations_onboarding.tenant_role_bindings WHERE invitation_id=$1',[invitationId]);
 if(state.rows[0]?.state!=='ACTIVE'||bindings.rows[0].n!==1)throw Error('B401_DB_STATE_INVALID');
 console.log('PASS: isolated HTTP verified provisioning to PostgreSQL, replay and cross-tenant denial');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await client.end();
}
