// B394 experimental trusted identity boundary. No hosted IdP is configured.
// The verifier is a server-controlled, independently reviewed token verifier;
// never pass client-asserted issuer/subject directly to persistence.
import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(v,'utf8').digest('hex');
export function createVerifiedInvitationAcceptor({repository,verifyIdentity,expectedAudience,allowedIssuers}){
 if(!repository||typeof repository.acceptVerified!=='function'||typeof verifyIdentity!=='function'
 ||typeof expectedAudience!=='string'||!expectedAudience
 ||!(allowedIssuers instanceof Set)||allowedIssuers.size===0)throw Error('IDENTITY_VERIFIER_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async accept({id,tenantId,actorId,token}){
   if(!id||!tenantId||!actorId||typeof token!=='string'||!token)throw Error('IDENTITY_PROOF_REQUIRED');
   const claims=await verifyIdentity(token);
   if(!claims||typeof claims!=='object'||typeof claims.issuer!=='string'
    ||!allowedIssuers.has(claims.issuer)||typeof claims.subject!=='string'||!claims.subject
    ||claims.audience!==expectedAudience||claims.verified!==true
    ||claims.mfaVerified!==true)throw Error('IDENTITY_PROOF_REJECTED');
   // Bind the verified subject, not a caller-provided identity claim.
   return repository.acceptVerified({id,tenantId,actorId,
    verifiedIssuer:claims.issuer,verifiedSubjectHash:digest(claims.subject)});
  }
 });
}
