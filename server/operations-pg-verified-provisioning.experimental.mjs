// B396 experimental verified identity -> atomic provisioning composition.
// The server-owned verifier MUST cryptographically validate token signature,
// expiry, issuer, audience and nonce before returning verified claims.
// No live identity provider or production access is configured.
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v,'utf8').digest('hex');
export function createVerifiedProvisioningFlow({provisioner,verifyIdentity,expectedAudience,allowedIssuers}){
 if(!provisioner||typeof provisioner.provision!=='function'||typeof verifyIdentity!=='function'
 ||typeof expectedAudience!=='string'||!expectedAudience
 ||!(allowedIssuers instanceof Set)||allowedIssuers.size===0)
  throw Error('VERIFIED_PROVISIONING_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async provision({invitationId,tenantId,actorId,role,token,expectedNonce}){
   if(!invitationId||!tenantId||!actorId||!role||typeof token!=='string'||!token||typeof expectedNonce!=='string'||!expectedNonce)
    throw Error('IDENTITY_PROOF_REQUIRED');
   const claims=await verifyIdentity(token,{nonce:expectedNonce});
   if(!claims||claims.verified!==true||claims.mfaVerified!==true
    ||typeof claims.issuer!=='string'||!allowedIssuers.has(claims.issuer)
    ||typeof claims.subject!=='string'||!claims.subject
    ||claims.audience!==expectedAudience)
    throw Error('IDENTITY_PROOF_REJECTED');
   return provisioner.provision({invitationId,tenantId,actorId,role,
    issuer:claims.issuer,subjectHash:hash(claims.subject),proofHash:hash(token),nonce:expectedNonce});
  }
 });
}
