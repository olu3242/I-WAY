// B447: server-only Supabase tenant-role persistence adapter.
// The supplied query must be a trusted privileged server connection.
// Never use this adapter with a publishable/anon client key.
export function createSupabaseTenantRoleStore({query}={}){
 if(typeof query!=='function')throw Error('SUPABASE_ROLE_STORE_QUERY_REQUIRED');
 return Object.freeze({
  async grant({userId,tenantId,role}={}){
   if(!isUuid(userId)||!isUuid(tenantId)||!['carrier','fleet','platform','driver'].includes(role))
    throw Error('INVALID_SUPABASE_ROLE_BINDING');
   const result=await query(`INSERT INTO iway_private.auth_tenant_roles
    (user_id,tenant_id,role,revoked_at)
    VALUES($1,$2,$3,NULL)
    ON CONFLICT(user_id,tenant_id,role) DO UPDATE SET revoked_at=NULL
    RETURNING user_id,tenant_id,role`,[userId,tenantId,role]);
   if(result.rowCount!==1)throw Error('SUPABASE_ROLE_BINDING_NOT_PERSISTED');
   return {userId,tenantId,role};
  },
  async hasActiveRole({userId,tenantId,role}={}){
   if(!isUuid(userId)||!isUuid(tenantId)||!['carrier','fleet','platform','driver'].includes(role))
    return false;
   const result=await query(`SELECT 1 FROM iway_private.auth_tenant_roles
    WHERE user_id=$1 AND tenant_id=$2 AND role=$3 AND revoked_at IS NULL`,
    [userId,tenantId,role]);
   return result.rowCount===1;
  }
 });
}
function isUuid(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
