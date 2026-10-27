// B398 experimental fail-closed session authorization boundary.
// This does not mint sessions; it checks a trusted session and DB role binding.
export function createTenantSessionAuthorizer({verifySession,lookupBinding}){
 if(typeof verifySession!=='function'||typeof lookupBinding!=='function')
  throw Error('SESSION_AUTHORIZATION_CONFIGURATION_REQUIRED');
 return Object.freeze({
  async authorize({sessionToken,tenantId,requiredRole}){
   if(typeof sessionToken!=='string'||!sessionToken||!tenantId||!requiredRole)
    throw Error('SESSION_AUTHORIZATION_REQUIRED');
   // verifySession must independently verify signature, expiry, audience and revocation.
   const session=await verifySession(sessionToken);
   if(!session||session.verified!==true||!session.accountId||!session.tenantId
    ||session.tenantId!==tenantId)
    throw Error('SESSION_AUTHORIZATION_REJECTED');
   const binding=await lookupBinding({tenantId,accountId:session.accountId,role:requiredRole});
   if(!binding||binding.active!==true||binding.tenantId!==tenantId
    ||binding.accountId!==session.accountId||binding.role!==requiredRole)
    throw Error('SESSION_ROLE_REJECTED');
   return Object.freeze({tenantId,accountId:session.accountId,role:requiredRole});
  }
 });
}
