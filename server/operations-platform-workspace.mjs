import {platformCaseContract} from '../domain/operations-platform-contract.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {isTrustedIdentitySession,requireAssurance,principalFingerprint} from './operations-identity.mjs';
import {effectiveAdminDenials} from '../domain/operations-admin-policy.mjs';
import {fields,text,integer,requireValue} from '../domain/operations-errors.mjs';
const permissions={list:'platform:audit',casecreate:'platform:cases',caseupdate:'platform:cases',config:'platform:configure',supportrequest:'platform:support'};
const transitions=platformCaseContract.transitions;
export function platformWorkspace(store,auth,input,now=Date.now()){
 fields(input,['action','id','expectedVersion','payload','idempotencyKey']);const permission=permissions[input.action];
 requireValue(isTrustedIdentitySession(store,auth,now),'SESSION','Sign in required.',401);requireAssurance(auth);const actor=store.principal(auth.actor.id);
 requireValue(actor?.active&&actor.role==='platform'&&principalFingerprint(actor)===principalFingerprint(auth.actor)&&permission&&actor.permissions.includes(permission)&&!effectiveAdminDenials(store,actor).has(permission),'FORBIDDEN','Explicit platform authority required.',403);
 const list=()=>({caseContract:platformCaseContract,cases:store.list('platformcase',actor.tenantId),configuration:store.list('platformconfig',actor.tenantId),supportRequests:store.list('supportrequest',actor.tenantId),staff:store.db.prepare('SELECT data FROM users WHERE tenant_id=?').all(actor.tenantId).map(r=>JSON.parse(r.data)).filter(p=>p.role==='platform').map(p=>({id:p.id,name:p.name,active:p.active,caseOwner:p.permissions.includes('platform:cases')})),capabilities:actor.permissions.filter(p=>Object.values(permissions).includes(p)),supportReadConfigured:false});
 if(input.action==='list'){fields(input.payload??{},[]);store.audit(actor,'platform:workspaceread',actor.id,'success',{},new Date(now).toISOString());return list();}
 requireValue(typeof input.idempotencyKey==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(input.idempotencyKey),'COMMAND','A stable request key is required.');const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex'),p=input.payload??{};
 return store.transaction(()=>{
  const previous=store.db.prepare('SELECT digest,result FROM commands WHERE tenant_id=? AND actor_id=? AND key=?').get(actor.tenantId,actor.id,input.idempotencyKey);if(previous){requireValue(previous.digest===digest,'IDEMPOTENCY','Request key already used.',409);return JSON.parse(previous.result);}
  let result;
  if(input.action==='casecreate'){
   fields(p,['title','category','source','tenantReference']);requireValue(platformCaseContract.categories.includes(p.category)&&platformCaseContract.sources.includes(p.source),'CASE','Choose a case category.');const tenantReference=text(p.tenantReference,100);requireValue(/^[a-zA-Z0-9 _.-]+$/.test(tenantReference),'CASE','Use an approved case/tenant reference.');
   result=store.insert('platformcase',actor.tenantId,{title:text(p.title,120),category:p.category,source:p.source,tenantReference,status:'new',ownerId:null,dueAt:store.list('platformconfig',actor.tenantId).find(r=>r.key==='supportCaseDueHours')?new Date(now+store.list('platformconfig',actor.tenantId).find(r=>r.key==='supportCaseDueHours').value*3600000).toISOString():null,createdAt:new Date(now).toISOString()});
  }else if(input.action==='caseupdate'){
   fields(p,['status','ownerId','reason']);const row=store.get('platformcase',input.id,actor.tenantId);requireValue(row.version===integer(input.expectedVersion,1),'STALE','Refresh the case.',409);text(p.reason,300);
   requireValue(transitions[row.status]?.includes(p.status)||row.status===p.status&&row.status!=='closed','TRANSITION','Invalid case transition.',409);const owner=store.principal(p.ownerId);requireValue(owner?.active&&owner.role==='platform'&&owner.tenantId===actor.tenantId&&owner.permissions.includes('platform:cases'),'OWNER','Choose an active platform case owner.');
   result=store.update('platformcase',row.id,actor.tenantId,row.version,{status:p.status,ownerId:owner.id,updatedAt:new Date(now).toISOString()});
   store.insert('platformcaseevent',actor.tenantId,{caseId:row.id,before:row.status,after:p.status,reason:text(p.reason,300),actorId:actor.id,at:new Date(now).toISOString()});
  }else if(input.action==='config'){
   fields(p,['key','value','reason']);text(p.reason,300);requireValue(p.key==='supportCaseDueHours','CONFIG','Only the reviewed support-case setting is supported.');const value=integer(p.value,1,720),existing=store.list('platformconfig',actor.tenantId).find(r=>r.key===p.key);
   if(existing){requireValue(existing.version===input.expectedVersion,'STALE','Refresh configuration.',409);result=store.update('platformconfig',existing.id,actor.tenantId,existing.version,{value,updatedBy:actor.id});}else{requireValue(input.expectedVersion===undefined,'STALE','Refresh configuration.',409);result=store.insert('platformconfig',actor.tenantId,{key:p.key,value,updatedBy:actor.id});}
  }else if(input.action==='supportrequest'){
   fields(p,['caseId','targetTenantId','scope','expiresAt','reason']);const row=store.get('platformcase',p.caseId,actor.tenantId);requireValue(row.status!=='closed','CASE','Use an open case.');requireValue(typeof p.targetTenantId==='string'&&/^[a-f0-9-]{36}$/i.test(p.targetTenantId)&&p.targetTenantId!==actor.tenantId,'TARGET','Use the owner-approved target UUID.');requireValue(['audit_summary','operational_summary'].includes(p.scope),'SCOPE','Choose a bounded read scope.');requireValue(Number.isSafeInteger(p.expiresAt)&&p.expiresAt>now&&p.expiresAt<=now+3600000,'EXPIRY','Request at most one hour.');
   result=store.insert('supportrequest',actor.tenantId,{caseId:row.id,targetTenantId:p.targetTenantId,scope:p.scope,expiresAt:p.expiresAt,reason:text(p.reason,300),requestedBy:actor.id,status:'awaiting_owner_approval',requestId:randomUUID()});
  }
  requireValue(result,'ACTION','Unsupported platform action.');store.audit(actor,'platform:'+input.action,result.id,'success',{status:result.status??'updated',version:result.version},new Date(now).toISOString());store.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?)').run(actor.tenantId,actor.id,input.idempotencyKey,digest,JSON.stringify(result));return result;
 });
}
