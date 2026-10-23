// Existing native Operations sessions remain the sole application-session owner.
// This bridge requires pre-existing principals/bindings; it never enrolls or links users.
import {createHash} from 'node:crypto';
import {authenticateIdentity,principalFingerprint} from './operations-identity.mjs';
import {session} from './operations-auth.mjs';
import {readAuthCookie,SESSION_COOKIE} from './operations-supabase-pkce-session.experimental.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const denied=()=>{throw Error('UAT_APPLICATION_SESSION_DENIED');};
const equalPermissions=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export const clearOperationsCookie='iway_ops=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';
export function createUatOperationsSessionBridge({origin,workflow,providerSessions,store,identityVerifier,platformNamespaceId,platformNamespaceVerified=false,clock=()=>Date.now()}={}){
 if(new URL(origin).origin!==origin||!origin.startsWith('https://')||![workflow?.session,workflow?.logout,providerSessions?.get,store?.principal].every(f=>typeof f==='function')||!identityVerifier||(!store.tenant(platformNamespaceId)&&!platformNamespaceVerified))throw Error('UAT_APPLICATION_BINDINGS_REQUIRED');
 // Platform namespace is an independently approved governance realm, not a carrier.
 if(store.db.prepare("SELECT 1 FROM users WHERE tenant_id=? AND json_extract(data,'$.role')<>'platform' LIMIT 1").get(platformNamespaceId)||store.db.prepare('SELECT 1 FROM resources WHERE tenant_id=? LIMIT 1').get(platformNamespaceId))throw Error('UAT_GOVERNANCE_NAMESPACE_INVALID');
 store.db.exec(`CREATE TABLE IF NOT EXISTS uat_application_sessions(
  parent_hash TEXT PRIMARY KEY,native_hash TEXT NOT NULL,user_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,issued_at INTEGER NOT NULL);`);
 const record=id=>valid(id)?store.db.prepare('SELECT * FROM uat_application_sessions WHERE parent_hash=?').get(hash(id)):null;
 function matches(actor,parent){
  if(!actor?.active||actor.identityOnly!==true||actor.id!==parent.principalId||actor.role!==parent.role||!equalPermissions(actor.permissions,parent.permissions)||
   (actor.fleetId??null)!==parent.fleetId||actor.tenantId!==(parent.role==='platform'?platformNamespaceId:parent.tenantId))return false;
  if(parent.role==='platform')return parent.tenantId===null&&parent.fleetId===null;
  if(['fleet','driver'].includes(parent.role)){
   try{if(!store.get('fleet',parent.fleetId,parent.tenantId).active)return false;}catch{return false;}
  }
  if(parent.role==='driver'){
   // Native employment is the active principal + matching active driver/fleet record.
   try{const driver=store.get('driver',actor.id,parent.tenantId);if(!driver.active||driver.fleetId!==parent.fleetId)return false;}catch{return false;}
  }
  return true;
 }
 function revokeNative(row){if(!row)return;store.transaction(()=>{
  store.db.prepare('UPDATE uat_application_sessions SET revoked=1 WHERE parent_hash=?').run(row.parent_hash);
  store.db.prepare('DELETE FROM sessions WHERE token=?').run(row.native_hash);
  const actor=store.principal(row.principal_id);if(actor)store.audit(actor,'session:uat-revoke',actor.id,'success');
 });}
 async function read(req,{refresh=false}={}){
  let parentId,nativeId;try{parentId=readAuthCookie(req.headers,SESSION_COOKIE);nativeId=readAuthCookie(req.headers,'iway_ops');}catch{return null;}const row=record(parentId);
  if(!row||row.revoked||!valid(nativeId)||row.native_hash!==hash(nativeId))return null;
  try{
   const parent=refresh?await workflow.sessionForRefresh?.(parentId):await workflow.session(parentId);
   let auth;
   if(refresh){
    const security=store.db.prepare('SELECT s.user_id,s.csrf,m.* FROM sessions s JOIN session_security m USING(token) WHERE s.token=?').get(hash(nativeId));
    const actor=security&&store.principal(security.user_id),now=clock();
    const binding=security&&store.db.prepare('SELECT user_id,tenant_id,active FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(security.issuer,security.subject_hash);
    if(actor?.active&&security.source==='federated'&&security.principal_fingerprint===principalFingerprint(actor)&&security.issued_at<=now&&now<security.issued_at+8*3600000&&now<security.last_seen_at+security.idle_timeout_ms&&binding?.active&&binding.user_id===actor.id&&binding.tenant_id===actor.tenantId)auth={actor,csrf:security.csrf};
   }else auth=session(store,nativeId,clock());
   if(!parent||parent.userId!==row.user_id||!auth||!matches(auth.actor,parent))denied();
   return auth;
  }catch{revokeNative(row);await workflow.logout(parentId).catch(()=>{});return null;}
 }
 async function establish(parentId,previousNativeId,{refresh=false}={}){
  if(!valid(parentId))denied();
  const previous=record(parentId);
  if(previous&&(previous.revoked||!valid(previousNativeId)||previous.native_hash!==hash(previousNativeId)||!await read({headers:{cookie:SESSION_COOKIE+'='+parentId+'; iway_ops='+previousNativeId}},{refresh})))denied();
  const parent=await workflow.session(parentId),tokens=await providerSessions.get(parentId);
  if(!parent||tokens?.user_id!==parent.userId||!matches(store.principal(parent.principalId),parent))denied();
  let issued;
  try{
   store.transaction(()=>{
    issued=authenticateIdentity(store,identityVerifier,tokens.access_token,clock());
    if(!matches(issued.actor,parent))denied();
    // Supabase's verified JWT subject must already bind to this internal principal.
    if(issued.actor.id!==parent.principalId)denied();
    store.db.prepare(`INSERT INTO uat_application_sessions VALUES(?,?,?,?,0,?)
     ON CONFLICT(parent_hash) DO UPDATE SET native_hash=excluded.native_hash,issued_at=excluded.issued_at`).run(hash(parentId),hash(issued.token),parent.userId,parent.principalId,clock());
    if(previous)store.db.prepare('DELETE FROM sessions WHERE token=?').run(previous.native_hash);
    store.audit(issued.actor,'session:uat-link',issued.actor.id,'success',{verifiedIdentity:true});
   });
   const current=await workflow.session(parentId);if(!current||!matches(store.principal(parent.principalId),current))denied();
   return 'iway_ops='+issued.token+'; Path=/; Max-Age='+Math.max(1,Math.floor((issued.expiresAt-clock())/1000))+'; HttpOnly; Secure; SameSite=Strict';
  }catch{revokeNative(record(parentId));await workflow.logout(parentId).catch(()=>{});denied();}
 }
 async function logout(req){const parentId=readAuthCookie(req.headers,SESSION_COOKIE);revokeNative(record(parentId));if(valid(parentId))await workflow.logout(parentId);}
 return Object.freeze({origin,read,readForRefresh:req=>read(req,{refresh:true}),establish,logout,clearCookie:clearOperationsCookie});
}
