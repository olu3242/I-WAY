/** Local operations admin adapter. SQLite is the currently integrated runtime;
 * PostgreSQL parity requires separate migration and RLS certification.
 */
import {rolePermissions} from '../domain/authorization.mjs';
import {validateOrganizationSettings,evaluateValidationRule,validateRuleDefinition} from '../domain/enterprise-admin.mjs';
import {authorizeOrganizationSettings} from '../domain/organization-settings-service.mjs';
const TYPES=['permission-set','permission-assignment','field-security','validation-rule','related-tab','page-layout','business-unit','location'];
const allowed={
 'permission-set':['name','description','grants','denials'],
 'permission-assignment':['name','setIds'],
 'field-security':['name','object','field','read','create','update','export','filter'],
 'validation-rule':['name','object','field','operator','value','enabled'],
 'related-tab':['name','object','relatedObject','label','order'],
 'page-layout':['name','object','fields','tabs'],
 'business-unit':['name','code','active'],
 'location':['name','address','timeZone','active']
};
const validAction=new Set(Object.values(rolePermissions).flat());
const idOk=v=>typeof v==='string'&&/^[a-zA-Z0-9][\w-]{0,127}$/.test(v);
function clean(type,data){
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed[type].includes(k)))throw new Error('INVALID_INPUT');
 const json=JSON.stringify(data);if(json.length>12000)throw new Error('INVALID_INPUT');
 if(!idOk(data.name)||data.name.length>128)throw new Error('INVALID_INPUT');
 if(type==='validation-rule'&&!validateRuleDefinition({...data,id:'rule',version:1,enabled:true}))throw new Error('INVALID_INPUT');
 if(type==='field-security'&&(!idOk(data.object)||!idOk(data.field)))throw new Error('INVALID_INPUT');
 if(type==='permission-assignment'&&(!Array.isArray(data.setIds)||data.setIds.length>30||!data.setIds.every(idOk)))throw new Error('INVALID_INPUT');
 if(type==='permission-set'){
  if(!Array.isArray(data.grants)||!Array.isArray(data.denials)||![...data.grants,...data.denials].every(v=>typeof v==='string'&&validAction.has(v)))throw new Error('INVALID_INPUT');
 }
 return JSON.parse(json);
}
export function createOperationsAdmin(store){
 store.db.exec(`CREATE TABLE IF NOT EXISTS organization_admin (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),kind TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,
  PRIMARY KEY(tenant_id,kind,id));
  CREATE INDEX IF NOT EXISTS organization_admin_scope ON organization_admin(tenant_id,kind);
  CREATE TABLE IF NOT EXISTS organization_admin_audit(
   seq INTEGER PRIMARY KEY AUTOINCREMENT,tenant_id TEXT NOT NULL,actor_id TEXT NOT NULL,kind TEXT NOT NULL,item_id TEXT NOT NULL,operation TEXT NOT NULL,version INTEGER NOT NULL);
  CREATE TRIGGER IF NOT EXISTS organization_admin_audit_immutable_update BEFORE UPDATE ON organization_admin_audit BEGIN SELECT RAISE(ABORT,'immutable'); END;
  CREATE TRIGGER IF NOT EXISTS organization_admin_audit_immutable_delete BEFORE DELETE ON organization_admin_audit BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
 const authorize=(actor,tenantId)=>authorizeOrganizationSettings(store.principal(actor.id),tenantId,'write');
 const audit=(actor,kind,id,operation,version)=>store.db.prepare('INSERT INTO organization_admin_audit(tenant_id,actor_id,kind,item_id,operation,version) VALUES(?,?,?,?,?,?)').run(actor.tenantId,actor.id,kind,id,operation,version);
 return Object.freeze({
  list(actor,kind){
   if(!authorize(actor,actor.tenantId)||!TYPES.includes(kind))return {ok:false,code:'FORBIDDEN'};
   const items=store.db.prepare("SELECT id,version,data FROM organization_admin WHERE tenant_id=? AND kind=? AND coalesce(json_extract(data,'$._deactivated'),0)=0 ORDER BY id LIMIT 200").all(actor.tenantId,kind);
   return {ok:true,items:items.map(x=>({id:x.id,version:x.version,...JSON.parse(x.data)}))};
  },
  getSettings(actor){
   if(!authorize(actor,actor.tenantId))return {ok:false,code:'FORBIDDEN'};
   const row=store.db.prepare("SELECT version,data FROM organization_admin WHERE tenant_id=? AND kind='settings' AND id='company'").get(actor.tenantId);
   return {ok:true,version:row?.version??0,settings:row?JSON.parse(row.data):{legalName:store.tenant(actor.tenantId)?.name??'',timeZone:store.tenant(actor.tenantId)?.timezone??'UTC',currency:'USD'}};
  },
  updateSettings(actor,settings,expectedVersion){
   if(!authorize(actor,actor.tenantId))return {ok:false,code:'FORBIDDEN'};
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!settings||Object.keys(settings).some(k=>!['legalName','displayName','timeZone','currency','dotNumber'].includes(k))||!validateOrganizationSettings(settings).valid)return {ok:false,code:'INVALID_INPUT'};
   return store.transaction(()=>{
    const before=this.getSettings(actor);if(before.version!==expectedVersion)return {ok:false,code:'CONFLICT'};
    const next=expectedVersion+1;
    store.db.prepare("INSERT INTO organization_admin(tenant_id,kind,id,version,data) VALUES(?,'settings','company',?,?) ON CONFLICT(tenant_id,kind,id) DO UPDATE SET version=excluded.version,data=excluded.data").run(actor.tenantId,next,JSON.stringify(settings));
    audit(actor,'settings','company','update',next);
    return {ok:true,version:next,settings};
   });
  },
  upsert(actor,kind,id,data,expectedVersion){
   if(!authorize(actor,actor.tenantId)||!TYPES.includes(kind)||!idOk(id)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)return {ok:false,code:'FORBIDDEN'};
   let value;try{value=clean(kind,data)}catch{return {ok:false,code:'INVALID_INPUT'}}
   return store.transaction(()=>{
    const before=store.db.prepare('SELECT version FROM organization_admin WHERE tenant_id=? AND kind=? AND id=?').get(actor.tenantId,kind,id);
    if((before?.version??0)!==expectedVersion)return {ok:false,code:'CONFLICT'};
    const version=expectedVersion+1;
    store.db.prepare('INSERT INTO organization_admin(tenant_id,kind,id,version,data) VALUES(?,?,?,?,?) ON CONFLICT(tenant_id,kind,id) DO UPDATE SET version=excluded.version,data=excluded.data').run(actor.tenantId,kind,id,version,JSON.stringify(value));
    audit(actor,kind,id,'upsert',version);return {ok:true,id,version};
   });
  },
  remove(actor,kind,id,expectedVersion){
   if(!authorize(actor,actor.tenantId)||!TYPES.includes(kind)||!idOk(id)||!Number.isSafeInteger(expectedVersion))return {ok:false,code:'FORBIDDEN'};
   return store.transaction(()=>{
    const row=store.db.prepare('SELECT version,data FROM organization_admin WHERE tenant_id=? AND kind=? AND id=?').get(actor.tenantId,kind,id);
    if(!row||row.version!==expectedVersion)return {ok:false,code:'CONFLICT'};
    if(JSON.parse(row.data)._deactivated)return {ok:false,code:'CONFLICT'};
    const version=expectedVersion+1;
    store.db.prepare('UPDATE organization_admin SET version=?,data=? WHERE tenant_id=? AND kind=? AND id=?').run(version,JSON.stringify({...JSON.parse(row.data),_deactivated:true}),actor.tenantId,kind,id);
    audit(actor,kind,id,'deactivate',version);return {ok:true,version};
   });
  },
  audit(actor){
   if(!authorize(actor,actor.tenantId))return {ok:false,code:'FORBIDDEN'};
   return {ok:true,events:store.db.prepare('SELECT kind,item_id AS itemId,operation,version FROM organization_admin_audit WHERE tenant_id=? ORDER BY seq DESC LIMIT 100').all(actor.tenantId)};
  }
 });
}
