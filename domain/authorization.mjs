/** Pure deny-by-default policy. Principals/relationships must come from storage. */
export const rolePermissions=Object.freeze({
 platform:['platform:invite','platform:audit'],
 carrier:['asset:service','settlement:manage','settlement:view',"load:create","load:view","load:validate","load:dispatch","asset:view","asset:manage","driver:approve","vehicle:approve","user:manage","fleet:manage","workflow:run","approval:decide","finance:manage","audit:view","exception:create","tracking:create","recommendation:view","customer:manage","document:manage","document:review","document:view","billing:manage","invoice:view","notification:manage","notification:preferences","analytics:view","intelligence:view","intelligence:analyze","capacity:recommend","capacity:approve","capacity:apply","cost:manage","orchestration:manage","connector:request","governance:manage"],
 dispatcher:["load:view","load:validate","load:dispatch","asset:view","workflow:run","audit:view","exception:create","tracking:create","recommendation:view","document:manage","document:review","document:view","pod:record","notification:manage","notification:preferences","analytics:view","intelligence:view","intelligence:analyze","capacity:recommend","capacity:apply","orchestration:manage","connector:request"],
 driver:['asset:service','settlement:view','payroll:view','load:view','load:execute','asset:view','exception:create','tracking:create','recommendation:view','document:manage','document:view','pod:record','notification:preferences'],
 fleet:['asset:service','settlement:view','settlement:dispute','payroll:manage','payroll:view','load:view','asset:view','asset:manage','employment:manage','notification:preferences'],
 customer:['load:view','document:view','invoice:view','notification:preferences'],
 automation:['workflow:run']
});
export function authorize({actor,action,resource}){
 if(actor?.role==='platform')return false; // Platform governance never grants operational tenant access.
 if(!actor?.id||!actor.tenantId||actor.tenantId!==resource?.tenantId||actor.active===false)return false;
 if(!rolePermissions[actor.role]?.includes(action)||!actor.permissions?.includes(action))return false;
 if(actor.role==='customer'&&(!actor.customerId||resource.customerId!==actor.customerId))return false;
 if(actor.role==='fleet'&&(!actor.fleetId||resource.fleetId!==actor.fleetId))return false;
 if(actor.role==='driver'&&resource.driverId!==actor.id&&!(resource.kind==='driver'&&resource.id===actor.id))return false;
 if(actor.role==='dispatcher'&&resource.dispatcherId&&resource.dispatcherId!==actor.id)return false;
 return true;
}

/** Existing role-specific delegation stays bounded by the current manager's matching operational authority. */
export function canDelegatePermission(actor,targetRole,permission){
 if(targetRole==='platform'||actor.role!=='carrier'||!actor.active||!actor.permissions?.includes('user:manage')||!rolePermissions[targetRole]?.includes(permission))return false;
 if(actor.permissions.includes(permission))return true;
 const prerequisite=({driver:{'asset:service':'asset:manage','load:execute':'load:dispatch','pod:record':'load:dispatch','payroll:view':'settlement:manage'},dispatcher:{'pod:record':'load:dispatch'},fleet:{'employment:manage':'fleet:manage','payroll:manage':'fleet:manage','payroll:view':'fleet:manage','settlement:dispute':'fleet:manage'}})[targetRole]?.[permission];
 return !!prerequisite&&actor.permissions.includes(prerequisite);
}
