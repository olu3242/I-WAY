// B416 PostgreSQL-backed activation lookup for isolated nonce cleanup recovery.
// Requires a server-owned, appropriately restricted database query function.
export function createPgActivationLookup(query){
 if(typeof query!=='function')throw Error('ACTIVATION_LOOKUP_CONFIGURATION_REQUIRED');
 return async function lookupActivation({invitationId,tenantId}={}){
  if(!invitationId||!tenantId)return null;
  const result=await query(`SELECT i.id AS invitation_id,i.tenant_id,i.state,
    count(b.invitation_id)::int AS binding_count
   FROM operations_onboarding.invitations i
   LEFT JOIN operations_onboarding.tenant_role_bindings b
    ON b.invitation_id=i.id AND b.tenant_id=i.tenant_id
   WHERE i.id=$1 AND i.tenant_id=$2
   GROUP BY i.id,i.tenant_id,i.state`,[invitationId,tenantId]);
  if(result.rowCount!==1)return null;
  const row=result.rows[0];
  return {invitationId:row.invitation_id,tenantId:row.tenant_id,
   state:row.state,bindingCount:Number(row.binding_count)};
 };
}
