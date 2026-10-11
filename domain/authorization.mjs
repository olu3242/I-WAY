/** Pure deny-by-default policy. Principals/relationships must come from storage. */
export const rolePermissions=Object.freeze({
 carrier:['load:create','load:view','load:validate','load:dispatch','asset:view','asset:manage','driver:approve','vehicle:approve','user:manage','fleet:manage','workflow:run','approval:decide','finance:manage','audit:view','exception:create','tracking:create','recommendation:view'],
 dispatcher:['load:view','load:validate','load:dispatch','asset:view','workflow:run','audit:view','exception:create','tracking:create','recommendation:view'],
 driver:['load:view','load:execute','asset:view','exception:create','tracking:create','recommendation:view'],
 fleet:['load:view','asset:view','asset:manage']
});
export function authorize({actor,action,resource}){
 if(!actor?.id||!actor.tenantId||actor.tenantId!==resource?.tenantId||actor.active===false)return false;
 if(!rolePermissions[actor.role]?.includes(action)||!actor.permissions?.includes(action))return false;
 if(actor.role==='fleet'&&(!actor.fleetId||resource.fleetId!==actor.fleetId))return false;
 if(actor.role==='driver'&&resource.driverId!==actor.id&&!(resource.kind==='driver'&&resource.id===actor.id))return false;
 if(actor.role==='dispatcher'&&resource.dispatcherId&&resource.dispatcherId!==actor.id)return false;
 return true;
}
