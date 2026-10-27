import {createHash} from 'node:crypto';
import {fields,integer,requireValue} from '../domain/operations-errors.mjs';
import {feedbackContract} from '../domain/operations-feedback-contract.mjs';
import {isTrustedIdentitySession,principalFingerprint,requireAssurance} from './operations-identity.mjs';
import {effectiveAdminDenials} from '../domain/operations-admin-policy.mjs';
const roles=['platform','carrier','fleet','driver'];
const can=(store,actor,permission)=>{
 const base=permission==='feedback:triage'?({platform:'platform:cases',carrier:'user:manage',fleet:'employment:manage'})[actor.role]:actor.role==='platform'?'platform:audit':'load:view';
 const denied=effectiveAdminDenials(store,actor);
 return actor.active&&roles.includes(actor.role)&&!!base&&actor.permissions.includes(base)&&Array.isArray(actor.uatFeedbackAccess)&&actor.uatFeedbackAccess.includes(permission.slice(9))&&!denied.has(base)&&!denied.has(permission);
};
const reviewer=(store,actor)=>['platform','carrier','fleet'].includes(actor.role)&&can(store,actor,'feedback:triage');
const visible=(store,actor,row)=>row.tenantId===actor.tenantId&&(row.reporterId===actor.id||reviewer(store,actor)&&(actor.role!=='fleet'||!!actor.fleetId&&row.fleetId===actor.fleetId));
const reference=value=>{requireValue(typeof value==='string'&&(/^[a-f0-9]{40}$/.test(value)||/^run-[a-zA-Z0-9_-]{8,64}$/.test(value)),'EVIDENCE','Use a reviewed commit SHA or opaque run reference.');return value;};

export function uatFeedback(store,auth,input,now=Date.now()){
 fields(input,['action','id','expectedVersion','payload','idempotencyKey']);
 requireValue(isTrustedIdentitySession(store,auth,now),'SESSION','Sign in required.',401);
 const actor=store.principal(auth.actor.id);
 requireValue(actor?.active&&principalFingerprint(actor)===principalFingerprint(auth.actor),'SESSION','Sign in required.',401);
 const submit=can(store,actor,'feedback:submit'),triage=reviewer(store,actor),p=input.payload??{};
 // A disabled capability reveals no records and does not alter native sign-in.
 if((submit||triage)&&['platform','carrier'].includes(actor.role))requireAssurance(auth);
 requireValue(['list','create','triage','retest'].includes(input.action),'ACTION','Unsupported feedback action.');
 if(input.action==='list'){
  fields(p,[]);const rows=submit||triage?store.list('uatfeedback',actor.tenantId).filter(row=>visible(store,actor,row)):[];
  const ids=new Set(rows.map(row=>row.id));
  return {enabled:submit||triage,canSubmit:submit,canTriage:triage,contract:feedbackContract,rows,
   events:store.list('uatfeedbackevent',actor.tenantId).filter(row=>ids.has(row.feedbackId)),
   owners:triage?store.db.prepare('SELECT data FROM users WHERE tenant_id=?').all(actor.tenantId).map(row=>JSON.parse(row.data)).filter(owner=>reviewer(store,owner)&&(actor.role!=='fleet'||owner.role==='fleet'&&owner.fleetId===actor.fleetId)).map(owner=>({id:owner.id,name:owner.name})):[]};
 }
 requireValue(input.action==='triage'?triage:submit,'FORBIDDEN','Explicit feedback permission required.',403);
 requireValue(typeof input.idempotencyKey==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(input.idempotencyKey),'COMMAND','A stable request key is required.');
 const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 return store.transaction(()=>{
  // Recheck current visibility even on replay; a stored receipt never grants access.
  const row=input.action==='create'?null:store.get('uatfeedback',input.id,actor.tenantId);
  if(row)requireValue(visible(store,actor,row),'FORBIDDEN','Feedback access denied.',403);
  if(input.action==='retest')requireValue(row.reporterId===actor.id,'FORBIDDEN','Only the reporter records acceptance.',403);
  const previous=store.db.prepare('SELECT digest,result FROM commands WHERE tenant_id=? AND actor_id=? AND key=?').get(actor.tenantId,actor.id,input.idempotencyKey);
  if(previous){requireValue(previous.digest===digest,'IDEMPOTENCY','Request key already used.',409);return JSON.parse(previous.result);}
  const at=new Date(now).toISOString();let result,event;
  if(input.action==='create'){
   fields(p,['workflow','symptom','severity','reproducibility']);
   for(const [key,values] of [['workflow',feedbackContract.workflows],['symptom',feedbackContract.symptoms],['severity',feedbackContract.severities],['reproducibility',feedbackContract.reproducibility]])requireValue(values.includes(p[key]),'FEEDBACK','Choose supported feedback metadata.');
   requireValue(store.list('uatfeedback',actor.tenantId).filter(item=>item.reporterId===actor.id&&Date.parse(item.createdAt)>now-600000).length<10,'RATE_LIMIT','Wait before submitting more feedback.',429);
   result=store.insert('uatfeedback',actor.tenantId,{...p,persona:actor.role,reporterId:actor.id,fleetId:actor.fleetId??null,ownerId:null,status:'reported',createdAt:at,updatedAt:at});
   event={before:null,after:'reported',reason:'reported'};
  }else{
   requireValue(row.version===integer(input.expectedVersion,1),'STALE','Refresh feedback before trying again.',409);
   if(input.action==='triage'){
    fields(p,['status','ownerId','reason','evidenceReference']);
    requireValue(feedbackContract.transitions[row.status]?.includes(p.status),'TRANSITION','Invalid feedback transition.',409);
    requireValue(feedbackContract.reasons.includes(p.reason),'REASON','Choose a reviewed reason code.');
    const owner=store.principal(p.ownerId);requireValue(owner?.tenantId===actor.tenantId&&reviewer(store,owner)&&(actor.role!=='fleet'||owner.role==='fleet'&&owner.fleetId===actor.fleetId),'OWNER','Choose an active authorized feedback owner.');
    const evidence=p.status==='awaiting_retest'?reference(p.evidenceReference):null;
    requireValue(p.status==='awaiting_retest'||p.evidenceReference===undefined,'EVIDENCE','Evidence is recorded for retest.');
    result=store.update('uatfeedback',row.id,actor.tenantId,row.version,{status:p.status,ownerId:owner.id,updatedAt:at,evidenceReference:evidence});
    event={before:row.status,after:p.status,reason:p.reason,evidenceReference:evidence};
   }else{
    fields(p,['passed','evidenceReference']);requireValue(row.status==='awaiting_retest'&&typeof p.passed==='boolean','TRANSITION','Feedback must await reporter retest.',409);
    const evidence=reference(p.evidenceReference),status=p.passed?'closed':'in_progress';
    result=store.update('uatfeedback',row.id,actor.tenantId,row.version,{status,updatedAt:at,retestEvidenceReference:evidence});
    event={before:row.status,after:status,reason:p.passed?'retest_passed':'retest_failed',evidenceReference:evidence};
   }
  }
  store.insert('uatfeedbackevent',actor.tenantId,{feedbackId:result.id,actorId:actor.id,at,...event});
  store.audit(actor,'feedback:'+input.action,result.id,'success',{status:result.status,version:result.version},at);
  store.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?)').run(actor.tenantId,actor.id,input.idempotencyKey,digest,JSON.stringify(result));return result;
 });
}
