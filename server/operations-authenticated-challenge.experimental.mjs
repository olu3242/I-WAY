// B406 experimental authenticated challenge custody.
// The identity assertion is a server-verified, short-lived session principal.
// No caller-provided tenant/role or raw nonce lookup is trusted.
import {timingSafeEqual} from 'node:crypto';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length>0&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createAuthenticatedChallengeCustody({issueNonce,resolveInvitation,storeNonce,readNonce,verifySession}){
 if([issueNonce,resolveInvitation,storeNonce,readNonce,verifySession].some(fn=>typeof fn!=='function'))
  throw Error('CHALLENGE_CUSTODY_CONFIGURATION_REQUIRED');
 async function authorize(sessionToken,invitationId){
  if(typeof sessionToken!=='string'||!sessionToken||typeof invitationId!=='string'||!invitationId)return null;
  const principal=await verifySession(sessionToken);
  if(!principal||principal.verified!==true||!principal.subject||!principal.issuer)return null;
  const invitation=await resolveInvitation(invitationId);
  if(!invitation||invitation.id!==invitationId||invitation.state!=='VERIFIED'||!invitation.tenantId
   ||!same(principal.issuer,invitation.issuer)||!same(principal.subjectHash,invitation.subjectHash)
   ||!Number.isFinite(new Date(invitation.expiresAt).getTime())||new Date(invitation.expiresAt).getTime()<=Date.now())return null;
  return invitation;
 }
 return Object.freeze({
  async issue({sessionToken,invitationId}){
   const invitation=await authorize(sessionToken,invitationId);
   if(!invitation)throw Error('CHALLENGE_ISSUANCE_DENIED');
   const nonce=await issueNonce({invitationId,tenantId:invitation.tenantId});
   await storeNonce({invitationId,tenantId:invitation.tenantId,nonce});
   return {nonce};
  },
  async read({sessionToken,invitationId,tenantId}){
   const invitation=await authorize(sessionToken,invitationId);
   if(!invitation||invitation.tenantId!==tenantId)return null;
   return readNonce({invitationId,tenantId});
  }
 });
}
