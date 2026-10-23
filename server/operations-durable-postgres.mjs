// PostgreSQL is authoritative. SQLite is a request-local compatibility execution engine;
// no local file, process cache or warm function instance owns durable state.
import {OperationsStore} from './operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {AsyncOperationsPgStore,OperationsPgError,verifyOperationsPgClient} from './operations-postgres.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {OpsError} from '../domain/operations-errors.mjs';
import {createOperationsAdmin} from './operations-admin.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const deny=code=>{throw new OperationsPgError(code);};
const quote=x=>'"'+x.replaceAll('"','""')+'"';
const names=store=>store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name);
export const durableBridgeSQL=`CREATE TABLE IF NOT EXISTS uat_application_sessions(parent_hash TEXT PRIMARY KEY,native_hash TEXT NOT NULL,user_id TEXT NOT NULL,principal_id TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,issued_at INTEGER NOT NULL);`;
export function exportTenantState(store,tenantId){
 if(!uuid(tenantId))deny('CONTEXT');
 const tables={};for(const name of names(store))tables[name]=store.db.prepare('SELECT * FROM '+quote(name)+' ORDER BY rowid').all().map(x=>({...x}));
 const userIds=new Set((tables.users??[]).filter(x=>x.tenant_id===tenantId).map(x=>x.id));
 const tokens=new Set((tables.sessions??[]).filter(x=>userIds.has(x.user_id)).map(x=>x.token));
 const invitationIds=new Set((tables.invitations??[]).filter(x=>x.tenant_id===tenantId).map(x=>x.id));
 for(const [name,rows] of Object.entries(tables))tables[name]=rows.filter(row=>{
  if(name==='tenants')return row.id===tenantId;
  if('tenant_id' in row)return row.tenant_id===tenantId;
  if(name==='session_security')return tokens.has(row.token);
  if(name==='uat_application_sessions')return userIds.has(row.principal_id);
  if(name==='invitation_deliveries')return invitationIds.has(row.invitation_id);
  if('user_id' in row)return userIds.has(row.user_id);
  // Empty/global schema metadata is not a source of cross-tenant authority.
  if(rows.length)deny('UNSCOPED_TABLE');return false;
 });
 const audit=tables.audit??[];delete tables.audit;
 return {payload:{format:'iway-tenant-engine-v1',tenantId,tables},audit};
}
export function materializeTenantState(payload,audit=[]){
 if(payload?.format!=='iway-tenant-engine-v1'||!uuid(payload.tenantId)||!payload.tables||typeof payload.tables!=='object')deny('STATE_FORMAT');
 const store=new OperationsStore(':memory:');store.db.exec(durableBridgeSQL);
 createOperationsAdmin(store);
 try{
  const allowed=new Set(names(store));
  const triggers=store.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
  store.db.exec('PRAGMA foreign_keys=OFF; BEGIN');
  for(const trigger of triggers)store.db.exec('DROP TRIGGER '+quote(trigger.name));
  const tables={...payload.tables,audit};
  for(const [name,rows] of Object.entries(tables)){
   if(!allowed.has(name)||!Array.isArray(rows))deny('STATE_FORMAT');
   const columns=store.db.prepare('PRAGMA table_info('+quote(name)+')').all().map(x=>x.name);
   for(const row of rows){
    if(Object.keys(row).length!==columns.length||columns.some(k=>!Object.hasOwn(row,k)))deny('STATE_FORMAT');
    if(name==='tenants'?row.id!==payload.tenantId:'tenant_id' in row&&row.tenant_id!==payload.tenantId)deny('OWNERSHIP');
    store.db.prepare('INSERT INTO '+quote(name)+'('+columns.map(quote).join(',')+') VALUES('+columns.map(()=>'?').join(',')+')').run(...columns.map(k=>row[k]));
   }
  }
  for(const trigger of triggers)store.db.exec(trigger.sql);
  if(store.db.prepare('PRAGMA foreign_key_check').all().length||store.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')deny('STATE_INTEGRITY');
  store.db.exec('COMMIT; PRAGMA foreign_keys=ON');return store;
 }catch(error){store.close();throw error;}
}
export class DurableOperationsPgEngine{
 constructor({pool,config,operationsOptions={}}={}){this.pool=pool;this.config=config;this.options=operationsOptions;this.identity=new AsyncOperationsPgStore(pool,{config});this.context=new AsyncLocalStorage();}
 async validatePlatformNamespace(id){if(!uuid(id))return false;await this.identity.health();const r=await this.pool.query('SELECT tenant_id FROM operations_engine_private.realms WHERE tenant_id=$1 AND governance AND active',[id]);return r.rowCount===1;}
 async verifyUatEntry(entry,platformNamespaceId){
  try{return await this.transaction({tenantId:entry.role==='platform'?platformNamespaceId:entry.tenantId,actorId:entry.principalId},({store})=>{
   const a=store.principal(entry.principalId);
   if(!a?.active||a.identityOnly!==true||a.role!==entry.role||JSON.stringify([...a.permissions].sort())!==JSON.stringify([...entry.permissions].sort())||(a.fleetId??null)!==(entry.fleetId??null))return false;
   if(entry.role==='platform')return entry.tenantId===null&&entry.fleetId===null;
   if(['fleet','driver'].includes(entry.role)&&!store.get('fleet',entry.fleetId,entry.tenantId).active)return false;
   if(entry.role==='driver'){const d=store.get('driver',a.id,entry.tenantId);if(!d.active||d.fleetId!==entry.fleetId)return false;}
   return true;
  });}catch{return false;}
 }
 async health(){
  await this.identity.health();
  const r=await this.pool.query("SELECT session_user,current_user,r.rolinherit,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid) AS membership,EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname='operations_engine_private' AND n.nspowner=r.oid) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_engine_private' AND c.relowner=r.oid) AS owner FROM pg_roles r WHERE r.rolname=current_user");
  const row=r.rows[0];if(!row||row.session_user!==this.config.expected.loginRole||row.current_user!==row.session_user||row.rolinherit||row.membership||row.owner)deny('RESTRICTED_ROLE');
  const tables=await this.pool.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_engine_private' AND c.relkind='r'");
  if(tables.rows.length!==5||tables.rows.some(x=>!x.relrowsecurity||!x.relforcerowsecurity))deny('SCHEMA');
  return {storage:'postgresql',identityVerified:true,restrictedRole:true,rls:true,scope:'tenant'};
 }
 async transaction(scope,work){
  if(!uuid(scope?.tenantId)||!uuid(scope?.actorId)||typeof work!=='function')deny('CONTEXT');
  const current=this.context.getStore();
  if(current){if(current.scope.tenantId!==scope.tenantId||current.scope.actorId!==scope.actorId)deny('CONTEXT');return work(current.value);}
  // Authenticate this actual transaction connection; never SET ROLE.
  let client,store,started=false,broken=false;
  const connectionFailed=()=>{broken=true;};
  try{
   client=await this.pool.connect();
   client.on('error',connectionFailed);
   await verifyOperationsPgClient(client,this.config);
   const flags=(await client.query("SELECT session_user,current_user,rolinherit,EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid) AS membership FROM pg_roles r WHERE rolname=current_user")).rows[0];
   if(!flags||flags.session_user!==this.config.expected.loginRole||flags.current_user!==flags.session_user||flags.rolinherit||flags.membership)deny('RESTRICTED_ROLE');
   await client.query('BEGIN');started=true;
   await client.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true),set_config('statement_timeout','15000',true),set_config('idle_in_transaction_session_timeout','15000',true),set_config('lock_timeout','5000',true)",[scope.tenantId,scope.actorId]);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope.tenantId]);
   const state=await client.query('SELECT version,payload FROM operations_engine_private.state WHERE tenant_id=$1 FOR UPDATE',[scope.tenantId]);
   if(state.rowCount!==1)deny('AUTHORIZATION');
   if(state.rows[0].payload?.tenantId!==scope.tenantId)deny('OWNERSHIP');
   const journal=await client.query('SELECT entry FROM operations_engine_private.audit WHERE tenant_id=$1 ORDER BY sequence',[scope.tenantId]);
   const before=journal.rows.map(x=>x.entry);store=materializeTenantState(state.rows[0].payload,before);
   const actor=store.principal(scope.actorId);if(!actor?.active||actor.tenantId!==scope.tenantId)deny('AUTHORIZATION');
   const value={store,operations:new Operations(store,{...createOperationsFeatures(),...this.options})};
   const result=await this.context.run({scope:{...scope},value},()=>work(value));
   const next=exportTenantState(store,scope.tenantId);
   const stable=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
   if(next.audit.length<before.length||before.some((entry,i)=>stable(entry)!==stable(next.audit[i])))deny('AUDIT_INTEGRITY');
   const oldAdmin=state.rows[0].payload.tables.organization_admin_audit??[],newAdmin=next.payload.tables.organization_admin_audit??[];
   if(newAdmin.length<oldAdmin.length||oldAdmin.some((entry,i)=>stable(entry)!==stable(newAdmin[i])))deny('AUDIT_INTEGRITY');
   for(const entry of next.audit.slice(before.length))await client.query('INSERT INTO operations_engine_private.audit(tenant_id,sequence,entry) VALUES($1,$2,$3::jsonb)',[scope.tenantId,entry.sequence,JSON.stringify(entry)]);
   if(Buffer.byteLength(JSON.stringify(next.payload))>33554432)deny('STATE_LIMIT');
   const changed=await client.query('UPDATE operations_engine_private.state SET payload=$1::jsonb,version=version+1 WHERE tenant_id=$2 AND version=$3',[JSON.stringify(next.payload),scope.tenantId,state.rows[0].version]);
   if(changed.rowCount!==1)deny('CONFLICT');
   await client.query('COMMIT');started=false;return result;
  }catch(error){if(started)await client.query('ROLLBACK').catch(()=>{broken=true;});if(error instanceof OperationsPgError||error instanceof OpsError)throw error;deny('UNAVAILABLE');}
  finally{store?.close();if(client){client.removeListener('error',connectionFailed);client.release(broken);}}
 }
}
