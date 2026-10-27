import {authorize,rolePermissions} from '../domain/authorization.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createPrivateResourceAuthorizer({pool}={}){
 if(typeof pool?.connect!=='function')throw Error('AUTHORIZATION_POOL_REQUIRED');
 return async function authorizeResource({userId,resourceId}={}){
  if(!uuid(userId)||!uuid(resourceId))return false;
  let client;
  try{
   client=await pool.connect();await client.query('BEGIN');
   await client.query("SELECT set_config('iway.user_id',$1,true)",[userId]);
   const result=await client.query(`SELECT r.resource_id,r.tenant_id,r.kind,r.fleet_id,r.driver_id,
     m.role,m.permissions,m.principal_id,m.fleet_id AS member_fleet_id
    FROM iway_private.auth_resources r JOIN iway_private.auth_tenants t ON t.tenant_id=r.tenant_id AND t.active
    JOIN iway_private.auth_tenant_roles m ON m.tenant_id=r.tenant_id
    WHERE r.resource_id=$1 AND r.active AND m.user_id=$2 AND m.active AND m.revoked_at IS NULL`,[resourceId,userId]);
   await client.query('COMMIT');
   return result.rows.some(row=>{
    if(!uuid(row.principal_id)||!Array.isArray(row.permissions))return false;
    const action=({load:'load:view',tracking:'load:view',asset:'asset:view',driver:'asset:view','tenant-audit':'platform:audit'})[row.kind];
    if(!action)return false;
    if(row.kind==='tenant-audit')return row.role==='platform'&&rolePermissions.platform.includes(action)&&row.permissions.includes(action);
    return authorize({actor:{id:row.principal_id,tenantId:row.tenant_id,role:row.role,permissions:row.permissions,
     fleetId:row.member_fleet_id,active:true},action,resource:{id:row.resource_id,tenantId:row.tenant_id,
     kind:row.kind,fleetId:row.fleet_id,driverId:row.driver_id}});
   });
  }catch{if(client)await client.query('ROLLBACK').catch(()=>{});return false;}
  finally{client?.release();}
 };
}
