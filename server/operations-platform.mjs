import {isTrustedIdentitySession,requireAssurance,principalFingerprint} from './operations-identity.mjs';
import {requireValue,text} from '../domain/operations-errors.mjs';
// Server-governed platform accounts live in a dedicated governance tenant. No operational bypass.
export function platformGovernance(store,auth,{action,targetId,reason},now=Date.now()){
 requireValue(isTrustedIdentitySession(store,auth,now),'SESSION','Sign in required.',401);requireAssurance(auth);
 const actor=store.principal(auth.actor.id);
 requireValue(actor?.active&&actor.role==='platform'&&principalFingerprint(actor)===principalFingerprint(auth.actor),'FORBIDDEN','Platform authority required.',403);
 if(action==='audit'){
  requireValue(actor.permissions.includes('platform:audit'),'FORBIDDEN','Platform audit permission required.',403);
  store.audit(actor,'platform:audit',actor.id,'success',{},new Date(now).toISOString());
  return store.db.prepare("SELECT action,resource_id,at,outcome,detail FROM audit WHERE tenant_id=? AND (action LIKE 'platform:%' OR action LIKE 'invitation:%') ORDER BY sequence DESC LIMIT 100").all(actor.tenantId);
 }
 requireValue(action==='suspend'&&actor.permissions.includes('platform:invite'),'FORBIDDEN','Platform action denied.',403);text(reason,300);
 const target=store.principal(targetId);requireValue(target?.role==='platform'&&target.tenantId===actor.tenantId&&target.id!==actor.id,'NOT_FOUND','Platform account not found.',404);
 return store.transaction(()=>{
  store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...target,active:false,authVersion:(target.authVersion??0)+1}),target.id);
  store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  store.audit(actor,'platform:suspend',target.id,'success',{reasonRecorded:true,before:{active:target.active},after:{active:false}},new Date(now).toISOString());
  return {id:target.id,active:false};
 });
}
