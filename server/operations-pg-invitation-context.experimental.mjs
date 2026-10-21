// B404 experimental trusted invitation context lookup.
// The supplied database client must be server-owned and authorized for this
// specific invitation; never derive tenant, actor or role from HTTP fields.
export function createPgInvitationContextResolver({query,resolveNonce}){
 if(typeof query!=='function'||typeof resolveNonce!=='function')
  throw Error('INVITATION_CONTEXT_CONFIGURATION_REQUIRED');
 return async function resolveInvitationContext({invitationId}={}){
  if(typeof invitationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId))
   return null;
  const result=await query(`SELECT id,tenant_id,creator_id,assignment
   FROM operations_onboarding.invitations
   WHERE id=$1 AND state='VERIFIED' AND expires_at>now()
   AND assignment->>'role' IN ('carrier','fleet','driver','platform')`,[invitationId]);
  if(result.rowCount!==1)return null;
  const row=result.rows[0];
  const expectedNonce=await resolveNonce({invitationId:row.id,tenantId:row.tenant_id});
  if(typeof expectedNonce!=='string'||!expectedNonce)return null;
  return {invitationId:row.id,tenantId:row.tenant_id,
   actorId:row.creator_id,role:row.assignment.role,expectedNonce};
 };
}
