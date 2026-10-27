/** Effective tenant administration restrictions. Explicit denies only: configuration cannot grant
 * any capability missing from the current actor, role or record relationship.
 * A permission set is active only after explicit assignment by a carrier administrator.
 */
import {rolePermissions,authorize} from './authorization.mjs';
const actions=new Set(Object.values(rolePermissions).flat());
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][\w-]{0,127}$/.test(v);
const hasAdminStore=store=>!!store?.db?.prepare?.("SELECT 1 FROM sqlite_master WHERE type='table' AND name='organization_admin'").get();
export function effectiveAdminDenials(store,actor){
 if(!actor?.id||!actor.tenantId||actor.active===false)return new Set(actions);
 // Without any configured administration storage, retain canonical authorization unchanged.
 if(!hasAdminStore(store))return new Set();
 const current=store.principal(actor.id);
 // Non-persisted automation principals are constrained by canonical role permissions.
 // Only a persisted, explicitly assigned set may impose additional denies.
 if(!current)return new Set();
 if(current.active===false||current.tenantId!==actor.tenantId)return new Set(actions);
 const rows=store.db.prepare("SELECT kind,id,data FROM organization_admin WHERE tenant_id=? AND kind IN ('permission-set','permission-assignment')").all(actor.tenantId);
 const sets=new Map(),assigned=new Set();
 for(const row of rows){
  let data;try{data=JSON.parse(row.data)}catch{continue}
  if(data._deactivated)continue;
  if(row.kind==='permission-set')sets.set(row.id,data);
  else if(row.id===actor.id&&Array.isArray(data.setIds))for(const setId of data.setIds)if(id(setId))assigned.add(setId);
 }
 const denied=new Set();
 for(const setId of assigned){
  const policy=sets.get(setId);
  if(!policy||!Array.isArray(policy.denials))continue;
  for(const action of policy.denials)if(actions.has(action))denied.add(action);
 }
 return denied;
}
export function authorizeConfigured({store,actor,action,resource}){
 if(!authorize({actor,action,resource}))return false;
 return !effectiveAdminDenials(store,actor).has(action);
}
export function projectConfiguredFields({store,actor,resource,object,record}){
 if(!record||typeof record!=='object'||Array.isArray(record))return {};
 if(!hasAdminStore(store))return {...record};
 const rows=store.db.prepare("SELECT data FROM organization_admin WHERE tenant_id=? AND kind='field-security'").all(actor.tenantId);
 const denied=new Set();
 for(const row of rows){
  let rule;try{rule=JSON.parse(row.data)}catch{continue}
  if(!rule._deactivated&&rule.object===object&&typeof rule.field==='string'&&Array.isArray(rule.read)&&rule.read.includes(actor.role)===false)denied.add(rule.field);
 }
 return Object.fromEntries(Object.entries(record).filter(([key])=>!denied.has(key)));
}
