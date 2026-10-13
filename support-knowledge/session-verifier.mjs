// B8: server-side adapter for a real identity-provider verifier and membership lookup.
// Neither caller-supplied role nor tenant is accepted as authority.
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x);
const roles=new Set(['driver','owner_operator','dispatcher','carrier_admin','carrier_operations','fleet_manager','fleet_admin','fleet_compliance','shipper','finance','support','platform_operations','security','platform_admin']);
export function createSopSessionVerifier({verifyBearerToken,lookupMembership}={}){
 if(typeof verifyBearerToken!=='function'||typeof lookupMembership!=='function')throw Error('SOP_AUTH_PORTS_REQUIRED');
 return async req=>{
  const header=req.headers?.authorization;
  if(typeof header!=='string'||!/^Bearer [^\s]+$/.test(header))return null;
  const token=header.slice(7);
  let principal;
  try{principal=await verifyBearerToken(token)}catch{return null}
  if(!principal||principal.active!==true||!valid(principal.subjectId))return null;
  let membership;
  try{membership=await lookupMembership(principal.subjectId)}catch{return null}
  if(!membership||membership.active!==true||!valid(membership.tenantId)||!roles.has(membership.role))return null;
  return Object.freeze({verified:true,tenantMembershipVerified:true,subjectId:principal.subjectId,tenantId:membership.tenantId,role:membership.role});
 };
}
