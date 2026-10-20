import {randomBytes,createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {authorize,rolePermissions,canDelegatePermission} from '../domain/authorization.mjs';
import {OpsError,fields,text,requireValue} from '../domain/operations-errors.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const hour=3600000,defaultIdle=30*60000;
const verifiers=new WeakSet(),proofs=new WeakSet(),trustedSessions=new WeakSet();
const sessionTokens=new WeakMap();
const atomic=(store,fn)=>store.db.isTransaction?fn():store.transaction(fn);
function trustedSession(value,token){Object.freeze(value.actor.permissions);Object.freeze(value.actor);Object.freeze(value);trustedSessions.add(value);sessionTokens.set(value,token);return value;}
export function isTrustedIdentitySession(store,auth,now=Date.now()){return trustedSessions.has(auth)&&!!readSession(store,sessionTokens.get(auth),now);}
export function verifyIdentityProof(verifier,token,now=Date.now()){requireValue(verifiers.has(verifier),'IDENTITY_CONFIG','A configured identity verifier is required.',503);return verifier.verify(token,now); }
export const identitySQL=`
 CREATE TABLE IF NOT EXISTS session_security(
 token TEXT PRIMARY KEY REFERENCES sessions(token) ON DELETE CASCADE,
 principal_fingerprint TEXT NOT NULL,issued_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL,
 idle_timeout_ms INTEGER NOT NULL CHECK(idle_timeout_ms BETWEEN 60000 AND 28800000),
 assurance TEXT NOT NULL CHECK(assurance IN ('aal1','aal2')),source TEXT NOT NULL CHECK(source IN ('local-password','federated')),
 issuer TEXT,subject_hash TEXT);
 CREATE TABLE IF NOT EXISTS identity_bindings(
 issuer TEXT NOT NULL,subject_hash TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),
 tenant_id TEXT NOT NULL REFERENCES tenants(id),active INTEGER NOT NULL CHECK(active IN (0,1)),
 PRIMARY KEY(issuer,subject_hash));
 CREATE INDEX IF NOT EXISTS identity_binding_user ON identity_bindings(tenant_id,user_id);
`;
export function principalFingerprint(actor){
 return hash(JSON.stringify({id:actor.id,tenantId:actor.tenantId,role:actor.role,permissions:[...actor.permissions].sort(),active:actor.active,fleetId:actor.fleetId??null,customerId:actor.customerId??null,authVersion:actor.authVersion??0}));
}
function current(store,actor){
 const principal=store.principal(actor?.id);
 requireValue(principal?.active,'SESSION','Sign in required.',401);
 return principal;
}
function identityError(){return new OpsError(401,'IDENTITY','Identity verification failed.');}
function issuerURL(value){
 requireValue(typeof value==='string'&&value===value.trim()&&value.length<=512,'IDENTITY_CONFIG','Configure an exact HTTPS identity issuer.');
 let url;try{url=new URL(value)}catch{throw new OpsError(422,'IDENTITY_CONFIG','Configure an exact HTTPS identity issuer.');}
 requireValue(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash,'IDENTITY_CONFIG','Configure an exact HTTPS identity issuer.');
 return value;
}
// Session rows retain their original four-column shape. New security metadata fails closed if absent.
export function issueSession(store,actor,{now=Date.now(),idleTimeoutMs=defaultIdle,proof=null}={}){
 actor=current(store,actor);
 requireValue(Number.isSafeInteger(now)&&now>=0&&now+8*hour<=8640000000000000&&Number.isSafeInteger(idleTimeoutMs)&&idleTimeoutMs>=60000&&idleTimeoutMs<=8*hour,'SESSION_CONFIG','Invalid session policy.');
 if(proof){
  requireValue(proofs.has(proof),'IDENTITY','Identity verification failed.',401);
  const binding=store.db.prepare('SELECT user_id,tenant_id,active FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(proof.issuer,hash(proof.subject));
  requireValue(binding?.active===1&&binding.user_id===actor.id&&binding.tenant_id===actor.tenantId&&proof.expiresAt>now,'IDENTITY','Identity verification failed.',401);
 }
 requireValue(actor.role!=='platform'||proof?.assurance==='aal2','MFA_REQUIRED','Platform sessions require verified MFA.',403);
 const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url'),tokenHash=hash(token);
 const source=proof?'federated':'local-password',assurance=proof?.assurance??'aal1',expiresAt=Math.min(now+8*hour,proof?.expiresAt??Infinity);
 const create=()=>{
  store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(tokenHash,actor.id,csrf,expiresAt);
  store.db.prepare('INSERT INTO session_security VALUES(?,?,?,?,?,?,?,?,?)').run(tokenHash,principalFingerprint(actor),now,now,idleTimeoutMs,assurance,source,proof?.issuer??null,proof?hash(proof.subject):null);
  store.audit(actor,'session:create',actor.id,'success',{source,assurance,verifiedMfa:!!proof&&assurance==='aal2',expiresAt},new Date(now).toISOString());
 };
 atomic(store,create);
 return trustedSession({token,csrf,actor,source,assurance,verifiedMfa:!!proof&&assurance==='aal2',expiresAt},token);
}
export function readSession(store,token,now=Date.now()){
 if(typeof token!=='string'||token.length>128||!Number.isSafeInteger(now)||now<0||now>8640000000000000)return null;
 const tokenHash=hash(token);
 const row=store.db.prepare('SELECT s.user_id,s.csrf,s.expires_at,m.* FROM sessions s LEFT JOIN session_security m ON m.token=s.token WHERE s.token=?').get(tokenHash);
 if(!row)return null;
 const actor=store.principal(row.user_id);
 let reason=!row.principal_fingerprint?'LEGACY_SESSION':!actor?.active?'ACCOUNT_INACTIVE':row.expires_at<=now?'ABSOLUTE_EXPIRY':row.last_seen_at+row.idle_timeout_ms<=now?'IDLE_EXPIRY':row.issued_at>now?'CLOCK_INVALID':row.principal_fingerprint!==principalFingerprint(actor)?'AUTHORITY_CHANGED':null;
 if(!reason&&row.source==='federated'){
  const binding=store.db.prepare('SELECT user_id,tenant_id,active FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(row.issuer,row.subject_hash);
  if(!binding?.active||binding.user_id!==actor.id||binding.tenant_id!==actor.tenantId)reason='BINDING_REVOKED';
 }
 if(reason){
  atomic(store,()=>{
   store.db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash);
   if(actor)store.audit(actor,'session:expired',actor.id,'denied',{category:reason},new Date(now).toISOString());
  });
  return null;
 }
 store.db.prepare('UPDATE session_security SET last_seen_at=? WHERE token=? AND last_seen_at<=?').run(now,tokenHash,now);
 return trustedSession({actor,csrf:row.csrf,source:row.source,assurance:row.assurance,verifiedMfa:row.source==='federated'&&row.assurance==='aal2',expiresAt:row.expires_at},token);
}
export function revokeSessions(store,actor,targetId=actor.id,reason='Account session revocation'){
 actor=current(store,actor);text(reason,300);const target=store.principal(targetId);
 requireValue(target?.tenantId===actor.tenantId,'NOT_FOUND','Account not found.',404);
 if(target.id!==actor.id)requireValue(actor.role==='carrier'&&authorize({actor,action:'user:manage',resource:target}),'FORBIDDEN','This action is not permitted.',403);
 return atomic(store,()=>{
  const result=store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  store.audit(actor,'session:revokeall',target.id,'success',{revoked:Number(result.changes),reasonRecorded:true});
  return {userId:target.id,revoked:Number(result.changes)};
 });
}
export function revokeSession(store,token,actor){
 actor=current(store,actor);
 requireValue(typeof token==='string'&&token.length<=128,'SESSION','Sign in required.',401);
 atomic(store,()=>{
  store.db.prepare('DELETE FROM sessions WHERE token=? AND user_id=?').run(hash(token),actor.id);
  store.audit(actor,'session:revoke',actor.id,'success');
 });
}
// Binding administration is a server API, never a match on client-supplied email/metadata.
export function bindIdentity(store,actor,{issuer,subject,userId,reason}){
 actor=current(store,actor);issuerURL(issuer);subject=subjectValue(subject);text(reason,300);
 requireValue(actor.role==='carrier'&&authorize({actor,action:'user:manage',resource:actor}),'FORBIDDEN','This action is not permitted.',403);
 const user=store.principal(userId);
 requireValue(user?.active&&user.tenantId===actor.tenantId,'NOT_FOUND','Account not found.',404);
 requireValue(user.permissions.every(permission=>canDelegatePermission(actor,user.role,permission)),'PERMISSIONS','Binding this account exceeds the reviewer authority.',403);
 requireValue(!store.db.prepare('SELECT 1 FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(issuer,hash(subject)),'BINDING_EXISTS','This identity already has a server-owned binding.',409);
 return atomic(store,()=>{
  store.db.prepare('INSERT INTO identity_bindings VALUES(?,?,?,?,1)').run(issuer,hash(subject),user.id,user.tenantId);
  store.audit(actor,'identity:bind',user.id,'success',{providerConfigured:true,reasonRecorded:true});
  return {userId:user.id,configured:true};
 });
}
export function revokeIdentityBinding(store,actor,{issuer,subject,userId,reason}){
 actor=current(store,actor);issuerURL(issuer);subjectValue(subject);text(reason,300);
 const user=store.principal(userId);
 requireValue(user?.tenantId===actor.tenantId,'NOT_FOUND','Account not found.',404);
 requireValue(actor.role==='carrier'&&authorize({actor,action:'user:manage',resource:user}),'FORBIDDEN','This action is not permitted.',403);
 return atomic(store,()=>{
  store.db.prepare('UPDATE identity_bindings SET active=0 WHERE issuer=? AND subject_hash=? AND user_id=? AND tenant_id=?').run(issuer,hash(subject),user.id,user.tenantId);
  const result=revokeSessions(store,actor,user.id,reason);
  store.audit(actor,'identity:revoke',user.id,'success',{reasonRecorded:true});
  return result;
 });
}
function subjectValue(value){
 requireValue(typeof value==='string'&&value.length>=1&&value.length<=512&&value===value.trim()&&!/[\u0000-\u001f\u007f]/.test(value),'IDENTITY','Identity verification failed.',401);
 return value;
}
function parseSegment(value){
 if(!/^[A-Za-z0-9_-]+$/.test(value))throw identityError();
 const decoded=Buffer.from(value,'base64url');
 if(decoded.toString('base64url')!==value)throw identityError();
 const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded));
 if(!result||Array.isArray(result)||typeof result!=='object')throw identityError();
 return result;
}
export function createIdentityVerifier({issuer,audience,keys,requireMfa=true,maxTokenAgeSeconds=3600}){
 issuerURL(issuer);requireValue(audience===text(audience,200),'IDENTITY_CONFIG','Configure an exact identity audience.');
 requireValue(typeof requireMfa==='boolean'&&Number.isInteger(maxTokenAgeSeconds)&&maxTokenAgeSeconds>=60&&maxTokenAgeSeconds<=28800&&Array.isArray(keys)&&keys.length>=1&&keys.length<=8,'IDENTITY_CONFIG','Configure trusted issuer keys and bounded token policy.');
 const ring=new Map();
 for(const entry of keys){
  fields(entry,['kid','algorithm','publicKey']);const kid=text(entry.kid,80);
  requireValue(!ring.has(kid)&&['RS256','ES256'].includes(entry.algorithm),'IDENTITY_CONFIG','Use unique keys and supported signature algorithms.');
  const key=entry.publicKey?.type==='public'?entry.publicKey:createPublicKey(entry.publicKey);
  requireValue(key.type==='public'&&(entry.algorithm==='RS256'?key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails.modulusLength>=2048:key.asymmetricKeyType==='ec'&&key.asymmetricKeyDetails.namedCurve==='prime256v1'),'IDENTITY_CONFIG','A suitable trusted public key is required.');
  ring.set(kid,{algorithm:entry.algorithm,key});
 }
 const verifier=Object.freeze({issuer,audience,verify(token,now=Date.now()){
  try{
   if(typeof token!=='string'||token.length>16384||!Number.isSafeInteger(now))throw identityError();
   const parts=token.split('.');if(parts.length!==3)throw identityError();
   const header=parseSegment(parts[0]),claims=parseSegment(parts[1]);
   if(Object.keys(header).some(k=>!['alg','kid','typ'].includes(k))||header.typ&&header.typ!=='JWT')throw identityError();
   const entry=ring.get(header.kid);
   if(!entry||entry.algorithm!==header.alg||!/^[A-Za-z0-9_-]+$/.test(parts[2]))throw identityError();
   const signature=Buffer.from(parts[2],'base64url');if(signature.toString('base64url')!==parts[2])throw identityError();
   const key=entry.algorithm==='ES256'?{key:entry.key,dsaEncoding:'ieee-p1363'}:entry.key;
   if(!verifySignature('sha256',Buffer.from(parts[0]+'.'+parts[1]),key,signature))throw identityError();
   const epoch=now/1000;
   if(claims.iss!==issuer||!(claims.aud===audience||Array.isArray(claims.aud)&&claims.aud.every(v=>typeof v==='string')&&claims.aud.includes(audience))||
      subjectValue(claims.sub)!==claims.sub||!Number.isSafeInteger(claims.exp)||claims.exp*1000>8640000000000000||claims.exp<=epoch||
      !Number.isSafeInteger(claims.iat)||claims.iat<0||claims.iat>epoch||epoch-claims.iat>maxTokenAgeSeconds||claims.exp<=claims.iat||
      claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>epoch)||
      !['aal1','aal2'].includes(claims.aal)||requireMfa&&claims.aal!=='aal2')throw identityError();
   const proof=Object.freeze({issuer,subject:claims.sub,audience,expiresAt:Math.min(claims.exp,claims.iat+maxTokenAgeSeconds)*1000,assurance:claims.aal});
   proofs.add(proof);return proof;
  }catch{throw identityError();}
 }});
 verifiers.add(verifier);return verifier;
}
export function authenticateIdentity(store,verifier,token,now=Date.now()){
 requireValue(verifiers.has(verifier),'IDENTITY_CONFIG','A configured server-owned identity verifier is required.',503);
 const proof=verifier.verify(token,now);
 const binding=store.db.prepare('SELECT user_id,tenant_id,active FROM identity_bindings WHERE issuer=? AND subject_hash=?').get(proof.issuer,hash(proof.subject));
 const actor=binding?.active===1?store.principal(binding.user_id):null;
 if(!actor?.active||actor.tenantId!==binding.tenant_id)throw identityError();
 return issueSession(store,actor,{now,proof});
}
export function requireAssurance(auth,required='aal2'){
 requireValue(trustedSessions.has(auth)&&required==='aal2'&&auth?.source==='federated'&&auth?.assurance==='aal2'&&auth?.verifiedMfa===true,'MFA_REQUIRED','A verified multi-factor identity session is required.',403);
 return true;
}
export function createIdentityExtensions(){return {
 'session:revoke':(ops,actor,c)=>{
  fields(c.payload??{},['reason']);requireValue(!c.resourceId||c.resourceId===actor.id,'FORBIDDEN','Use your own account session action.',403);
  return revokeSessions(ops.store,actor,actor.id,text(c.payload.reason,300));
 },
 'user:access':(ops,actor,c)=>{
  fields(c.payload??{},['role','permissions','reason']);const p=c.payload,reason=text(p.reason,300);
  ops.guard(actor,'user:manage',{tenantId:actor.tenantId});
  requireValue(actor.role==='carrier'&&c.resourceId!==actor.id,'SELF_ACCESS','A different carrier administrator must review account access.',403);
  const target=ops.store.principal(c.resourceId);requireValue(target?.active&&target.tenantId===actor.tenantId,'NOT_FOUND','Account not found.',404);
  requireValue(Number.isInteger(c.expectedVersion)&&c.expectedVersion===(target.authVersion??0),'STALE','Refresh account access before trying again.',409);
  const role=p.role??target.role;
  requireValue(role===target.role||['carrier','dispatcher'].includes(role)&&['carrier','dispatcher'].includes(target.role)&&!target.fleetId&&!target.customerId,'ROLE_RELATIONSHIP','Role change would alter an employment or customer relationship.',403);
  requireValue(Array.isArray(p.permissions)&&p.permissions.length<=100&&new Set(p.permissions).size===p.permissions.length&&p.permissions.every(permission=>rolePermissions[role]?.includes(permission)&&(role===target.role&&target.permissions.includes(permission)||canDelegatePermission(actor,role,permission))),'PERMISSIONS','Requested grants exceed the role or reviewer authority.',403);
  const updated={...target,role,permissions:[...p.permissions],authVersion:(target.authVersion??0)+1};
  ops.store.db.prepare('UPDATE users SET data=? WHERE id=? AND tenant_id=?').run(JSON.stringify(updated),target.id,actor.tenantId);
  revokeSessions(ops.store,actor,target.id,reason);
  ops.store.audit(actor,c.action,target.id,'success',{previousRole:target.role,role,previousPermissions:target.permissions,permissions:updated.permissions,authVersion:updated.authVersion,reasonRecorded:true},ops.now().toISOString());
  return {id:updated.id,role:updated.role,permissions:updated.permissions,authVersion:updated.authVersion,active:updated.active};
 }
};}
