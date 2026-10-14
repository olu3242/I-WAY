import{createHash}from'node:crypto';import{authorize}from'./authorization.mjs';import{fields,text,integer,requireValue}from'./operations-errors.mjs';
const can=(actor,action,resource)=>authorize({actor,action,resource});
function governor(ops,actor){ops.guard(actor,'governance:manage',{tenantId:actor.tenantId});requireValue(actor.role==='carrier','GOVERNANCE','Carrier governance authority is required.',403);}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function policy(ops,actor,c){governor(ops,actor);const p=ops.read('retentionpolicy',c.resourceId,actor);ops.version(p,c.expectedVersion);return p;}
export function assertApprovedConsent(version,purpose,registry){
 requireValue(typeof version==='string'&&/^[A-Za-z0-9._-]{1,30}$/.test(version)&&! /^(TBC|TODO|placeholder|YOUR[_-].*)$/i.test(version),'CONSENT_VERSION','Use a separately approved consent version.');
 const approved=registry.find(item=>item.version===version&&item.purpose===purpose&&item.approved===true&&/^[a-f0-9]{64}$/.test(item.textSha256));
 requireValue(!!approved,'CONSENT_UNAPPROVED','Consent approval is a separate gate; no version is activated.',409);return approved;
}
export function createComplianceExtensions({approvedConsents=[]}={}){
 const registry=approvedConsents.map(value=>Object.freeze({...value}));
 return {
  'retention:propose':(ops,actor,c)=>{
   governor(ops,actor);const p=c.payload??{};fields(p,['resourceKind','minimumDays','reason']);requireValue(['document','tracking','notification'].includes(p.resourceKind),'RETENTION_KIND','Select a supported review category.');
   return ops.create(actor,'retentionpolicy',{resourceKind:p.resourceKind,minimumDays:integer(p.minimumDays,1,36500),reason:text(p.reason,300),status:'pending',requestedBy:actor.id,createdAt:ops.now().toISOString(),executionEnabled:false},c.action);
  },
  'retention:decide':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['decision','reason']);const item=policy(ops,actor,c);
   requireValue(item.status==='pending'&&item.requestedBy!==actor.id,'SEPARATION','A different carrier governor must review the pending policy.',403);
   requireValue(['approved','rejected'].includes(p.decision),'DECISION','Choose an explicit decision.');
   return ops.change(actor,item,{status:p.decision,decidedBy:actor.id,decidedAt:ops.now().toISOString()},c.action,text(p.reason,300));
  },
  'retention:preview':(ops,actor,c)=>{
   fields(c.payload??{},[]);const p=policy(ops,actor,c),reviewer=ops.store.principal(p.decidedBy);
   requireValue(p.status==='approved'&&reviewer?.active&&reviewer.role==='carrier'&&can(reviewer,'governance:manage',{tenantId:actor.tenantId}),'APPROVAL_AUTHORITY','An active independent policy approval is required.',403);
   const cutoff=new Date(ops.now().getTime()-p.minimumDays*86400000).toISOString();
   const candidates=ops.store.list(p.resourceKind,actor.tenantId).filter(r=>!r.legalHold&&(r.createdAt??r.at??'9999')<cutoff&&(!r.loadId||can(actor,'load:view',ops.read('load',r.loadId,actor)))).map(r=>r.id);
   ops.store.audit(actor,c.action,p.id,'success',{count:candidates.length,executionEnabled:false},ops.now().toISOString());
   return {kind:'retentionpreview',tenantId:actor.tenantId,policyId:p.id,policyVersion:p.version,asOf:ops.now().toISOString(),candidateIds:candidates,executionEnabled:false,notice:'Preview only. Approval here does not establish legal retention authority or delete records.'};
  },
  'audit:export':(ops,actor,c)=>{
   governor(ops,actor);ops.guard(actor,'audit:view',{tenantId:actor.tenantId});fields(c.payload??{},['fromSequence','limit','reason']);
   const start=integer(c.payload.fromSequence??0,0,Number.MAX_SAFE_INTEGER),limit=integer(c.payload.limit??100,1,500),reason=text(c.payload.reason,300);
   const entries=ops.store.db.prepare('SELECT sequence,actor_id AS actorId,action,resource_id AS resourceId,at,outcome FROM audit WHERE tenant_id=? AND sequence>? ORDER BY sequence LIMIT ?').all(actor.tenantId,start,limit);
   const result=ops.store.insert('governanceexport',actor.tenantId,{format:'audit-metadata-v1',createdAt:ops.now().toISOString(),requestedBy:actor.id,reason,entries,sha256:digest(entries),nextSequence:entries.at(-1)?.sequence??start,detailsIncluded:false});
   ops.store.audit(actor,c.action,result.id,'success',{entryCount:entries.length,sha256:result.sha256,reasonRecorded:true},ops.now().toISOString());return result;
  },
  'privacy:export':(ops,actor,c)=>{
   fields(c.payload??{},[]);ops.store.audit(actor,c.action,actor.id,'success',{scope:'own_account_profile'},ops.now().toISOString());
   return {kind:'privacyexport',tenantId:actor.tenantId,userId:actor.id,generatedAt:ops.now().toISOString(),profile:{id:actor.id,name:actor.name,username:actor.username,role:actor.role,active:actor.active},credentialsIncluded:false};
  },
  'consent:record':(ops,actor,c)=>{
   fields(c.payload??{},['version','purpose','decision']);const p=c.payload,approved=assertApprovedConsent(p.version,p.purpose,registry);requireValue(['accept','withdraw'].includes(p.decision),'CONSENT_DECISION','Choose an explicit consent decision.');
   return ops.create(actor,'consentrecord',{userId:actor.id,consentVersion:approved.version,purpose:approved.purpose,textSha256:approved.textSha256,decision:p.decision,at:ops.now().toISOString(),source:'authenticated_user'},c.action);
  }
 };
}
export function complianceState(ops,actor){
 const govern=actor.role==='carrier'&&can(actor,'governance:manage',{tenantId:actor.tenantId});
 return {retentionPolicies:govern?ops.store.list('retentionpolicy',actor.tenantId):[],consentRecords:ops.store.list('consentrecord',actor.tenantId).filter(r=>r.userId===actor.id),complianceDisclosure:'Retention is preview-only; approved consent text and production privacy policy remain separate gates.'};
}
export const complianceIntegritySQL=`
 CREATE TRIGGER IF NOT EXISTS governance_evidence_no_update BEFORE UPDATE ON resources WHEN OLD.kind IN ('governanceexport','consentrecord') BEGIN SELECT RAISE(ABORT,'Governance evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS governance_evidence_no_delete BEFORE DELETE ON resources WHEN OLD.kind IN ('governanceexport','consentrecord') BEGIN SELECT RAISE(ABORT,'Governance evidence is immutable'); END;
`;
