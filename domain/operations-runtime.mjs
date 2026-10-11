import {randomUUID} from 'node:crypto';
import {authorize} from './authorization.mjs';
import {fields,text,integer,requireValue} from './operations-errors.mjs';
import {shippingDocumentReadiness} from './operations-documents.mjs';
import {connectorCapabilities,validateConnectorInput,connectorSnapshot,invokeConnector,validateConnectorResult,connectorBinding} from './operations-connectors.mjs';

export const agentRegistry=Object.freeze({
 dispatch:Object.freeze({tool:'dispatch:summary',permissions:Object.freeze(['load:view','asset:view'])}),
 tracking:Object.freeze({tool:'tracking:summary',permissions:Object.freeze(['load:view'])}),
 documents:Object.freeze({tool:'documents:summary',permissions:Object.freeze(['load:view','document:view'])}),
 exceptions:Object.freeze({tool:'exceptions:summary',permissions:Object.freeze(['load:view'])}),
 finance:Object.freeze({tool:'finance:readiness',permissions:Object.freeze(['load:view','billing:manage'])})
});
export const governedTools=Object.freeze([...Object.values(agentRegistry).map(a=>a.tool),...connectorCapabilities.map(c=>'connector:'+c)]);
const jobKinds=['orchestration','connectorjob'];
const terminal=['completed','cancelled','dead_letter','blocked'];
const permission=job=>job.kind==='orchestration'?'orchestration:manage':'connector:request';
const service=tenantId=>({id:'bounded-runtime-service',tenantId,active:true,role:'automation',permissions:[]});
const safeScope=actor=>({tenantId:actor.tenantId});
const can=(actor,action,resource)=>authorize({actor,action,resource});
function policy(ops,tenantId){return ops.store.list('governancepolicy',tenantId)[0]??{enabled:true,disabledTools:[],version:0};}
function plan(actor,load){return Object.entries(agentRegistry).filter(([,entry])=>entry.permissions.every(p=>can(actor,p,load))).map(([role,entry])=>({role,tool:entry.tool}));}
function tool(job){return job.kind==='connectorjob'?'connector:'+job.capability:job.plan[job.checkpoint]?.tool;}
function authorized(ops,job){
 const actor=ops.store.principal(job.requestedBy);
 const load=ops.store.list('load',job.tenantId).find(l=>l.id===job.loadId);
 if(!actor?.active||!load||!['carrier','dispatcher'].includes(actor.role)||!can(actor,permission(job),load)||!can(actor,'load:view',load))return {error:'AUTHORITY_CHANGED'};
 if(load.version!==job.loadVersion)return {error:'LOAD_CHANGED'};
 const current=policy(ops,job.tenantId);
 if(!current.enabled||current.disabledTools.includes(tool(job)))return {error:'POLICY_BLOCKED'};
 if(job.kind==='orchestration'){
  const step=job.plan[job.checkpoint],entry=agentRegistry[step?.role];
  if(!entry||entry.tool!==step.tool||!entry.permissions.every(p=>can(actor,p,load)))return {error:'TOOL_AUTHORITY_CHANGED'};
 }else{
  try{validateConnectorInput(ops,actor,load,job.capability,job.input)}catch{return {error:'CONNECTOR_AUTHORITY_CHANGED'};}
 }
 return {actor,load,policyVersion:current.version};
}
function writeJob(ops,job,patch,action,reason=''){
 const next=ops.store.update(job.kind,job.id,job.tenantId,job.version,patch);
 // Decision audit is bounded metadata; connector input/results and user-provided evidence are not repeated in audit detail.
 ops.store.audit(service(job.tenantId),action,job.id,'success',{kind:job.kind,loadId:job.loadId,from:job.status,to:next.status,checkpoint:next.checkpoint,fence:next.fence,reasonCode:reason||null},ops.now().toISOString());
 return next;
}
function humanChange(ops,actor,job,patch,action,reason){
 const result=ops.store.update(job.kind,job.id,job.tenantId,job.version,{...patch,overrideReason:reason});
 ops.store.audit(actor,action,job.id,'success',{loadId:job.loadId,from:job.status,to:result.status,fence:result.fence,reasonRecorded:!!reason},ops.now().toISOString());
 return result;
}
function jobRecord(ops,actor,load,kind,values,action){
 const now=ops.now().toISOString();
 const record=ops.store.insert(kind,actor.tenantId,{loadId:load.id,loadVersion:load.version,requestedBy:actor.id,status:'pending',checkpoint:0,attempts:0,totalAttempts:0,runNumber:1,fence:0,leaseOwner:null,leaseUntil:null,nextAttemptAt:null,lastError:null,decisionIds:[],createdAt:now,...values});
 ops.store.audit(actor,action,record.id,'success',{loadId:load.id,kind,capability:record.capability??null,plan:record.plan??null},now);
 return record;
}
function humanJob(ops,actor,c,kind){
 const job=ops.read(kind,c.resourceId,actor),load=ops.read('load',job.loadId,actor,permission(job));ops.version(job,c.expectedVersion);
 requireValue(['carrier','dispatcher'].includes(actor.role),'RUNTIME_AUTHORITY','A human operations principal is required.',403);
 return {job,load};
}
function retry(ops,actor,c,kind){
 fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),{job,load}=humanJob(ops,actor,c,kind);
 requireValue(['dead_letter','blocked'].includes(job.status),'JOB_STATE','Only blocked or dead-letter jobs can be reauthorized.',409);
 const current=policy(ops,actor.tenantId);requireValue(current.enabled,'POLICY_BLOCKED','Automation is disabled by the carrier policy.',409);
 const patch={status:'pending',checkpoint:0,attempts:0,nextAttemptAt:null,lastError:null,leaseOwner:null,leaseUntil:null,fence:job.fence+1,loadVersion:load.version,requestedBy:actor.id,runNumber:job.runNumber+1,decisionIds:[],reauthorizedBy:actor.id,reauthorizedAt:ops.now().toISOString()};
 if(kind==='orchestration')patch.plan=plan(actor,load);
 else validateConnectorInput(ops,actor,load,job.capability,job.input);
 return humanChange(ops,actor,job,patch,c.action,reason);
}
function cancel(ops,actor,c,kind){
 fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),{job}=humanJob(ops,actor,c,kind);
 requireValue(!['completed','cancelled'].includes(job.status),'JOB_STATE','This job cannot be cancelled.',409);
 return humanChange(ops,actor,job,{status:'cancelled',fence:job.fence+1,leaseOwner:null,leaseUntil:null,cancelledBy:actor.id,cancelledAt:ops.now().toISOString()},c.action,reason);
}
export function createRuntimeExtensions(){
 return {
  'orchestration:request':(ops,actor,c)=>{
   fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'orchestration:manage');ops.version(load,c.expectedVersion);
   requireValue(['carrier','dispatcher'].includes(actor.role),'RUNTIME_AUTHORITY','A human operations principal is required.',403);
   requireValue(load.status!=='void','JOB_STATE','Voided shipments cannot start advisory jobs.',409);
   requireValue(policy(ops,actor.tenantId).enabled,'POLICY_BLOCKED','Automation is disabled by the carrier policy.',409);
   requireValue(!ops.store.list('orchestration',actor.tenantId).some(j=>j.loadId===load.id&&!terminal.includes(j.status)),'JOB_EXISTS','A shipment advisory job is already active.',409);
   return jobRecord(ops,actor,load,'orchestration',{plan:plan(actor,load),source:'deterministic-rules',model:null,registryVersion:'1'},c.action);
  },
  'orchestration:retry':(ops,a,c)=>retry(ops,a,c,'orchestration'),
  'orchestration:cancel':(ops,a,c)=>cancel(ops,a,c,'orchestration'),
  'connector:request':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['capability','input']);const load=ops.read('load',c.resourceId,actor,'connector:request');ops.version(load,c.expectedVersion);
   requireValue(['carrier','dispatcher'].includes(actor.role),'RUNTIME_AUTHORITY','A human operations principal is required.',403);
   requireValue(load.status!=='void','JOB_STATE','Voided shipments cannot start integrations.',409);
   const current=policy(ops,actor.tenantId);requireValue(current.enabled&&!current.disabledTools.includes('connector:'+p.capability),'POLICY_BLOCKED','The carrier policy blocks this connector.',409);
   const input=validateConnectorInput(ops,actor,load,p.capability,p.input);
   requireValue(!ops.store.list('connectorjob',actor.tenantId).some(j=>j.loadId===load.id&&j.capability===p.capability&&!terminal.includes(j.status)),'JOB_EXISTS','This shipment already has an active job for this connector.',409);
   return jobRecord(ops,actor,load,'connectorjob',{capability:p.capability,input,source:input.source,externalIntegration:false},c.action);
  },
  'connector:retry':(ops,a,c)=>retry(ops,a,c,'connectorjob'),
  'connector:cancel':(ops,a,c)=>cancel(ops,a,c,'connectorjob'),
  'governance:update':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['enabled','disabledTools','reason']);ops.guard(actor,'governance:manage',safeScope(actor));const reason=text(p.reason,300);
   requireValue(actor.role==='carrier'&&typeof p.enabled==='boolean'&&Array.isArray(p.disabledTools)&&new Set(p.disabledTools).size===p.disabledTools.length&&p.disabledTools.every(x=>governedTools.includes(x)),'GOVERNANCE','Choose only known advisory tools and an explicit enablement state.');
   const existing=ops.store.list('governancepolicy',actor.tenantId)[0];
   const values={enabled:p.enabled,disabledTools:p.disabledTools,reason,updatedBy:actor.id,updatedAt:ops.now().toISOString(),registryVersion:'1'};
   if(existing){requireValue(c.resourceId===existing.id,'GOVERNANCE','Use the existing carrier policy.',409);ops.version(existing,c.expectedVersion);return ops.change(actor,existing,values,c.action,reason);}
   requireValue(!c.resourceId,'GOVERNANCE','No carrier policy exists.',404);return ops.create(actor,'governancepolicy',values,c.action);
  }
 };
}

// Every claim is a short immediate transaction. No adapter or asynchronous work occurs while SQLite holds its write lock.
export function claimJob(ops,{tenantId,kind,jobId,workerId,leaseMs=30000,adapters}){
 requireValue(jobKinds.includes(kind),'JOB_KIND','Unknown job kind.');requireValue(typeof workerId==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(workerId),'WORKER','Invalid worker identity.');integer(leaseMs,100,60000);
 return ops.store.transaction(()=>{
  let job=ops.store.get(kind,jobId,tenantId),now=ops.now().toISOString();
  if(terminal.includes(job.status)||job.status==='retry'&&job.nextAttemptAt>now||job.status==='running'&&job.leaseUntil>now)return null;
  const authority=authorized(ops,job);
  if(authority.error){writeJob(ops,job,{status:'blocked',lastError:authority.error,leaseOwner:null,leaseUntil:null,fence:job.fence+1},'runtime:blocked',authority.error);return null;}
  if(job.attempts>=3){writeJob(ops,job,{status:'dead_letter',lastError:'ATTEMPTS_EXHAUSTED',leaseOwner:null,leaseUntil:null,fence:job.fence+1},'runtime:deadletter','ATTEMPTS_EXHAUSTED');return null;}
  let adapterBinding=null;if(job.kind==='connectorjob')try{adapterBinding=connectorBinding(job.capability,job.input.source,adapters)}catch{}
  job=writeJob(ops,job,{adapterBinding,status:'running',attempts:job.attempts+1,totalAttempts:job.totalAttempts+1,leaseOwner:workerId,leaseUntil:new Date(ops.now().getTime()+leaseMs).toISOString(),fence:job.fence+1,policyVersion:authority.policyVersion},'runtime:claim');
  return {tenantId:job.tenantId,kind:job.kind,jobId:job.id,workerId,fence:job.fence,checkpoint:job.checkpoint,runNumber:job.runNumber};
 });
}
function held(ops,claim){
 const job=ops.store.get(claim.kind,claim.jobId,claim.tenantId);
 if(job.status!=='running'||job.leaseOwner!==claim.workerId||job.fence!==claim.fence||job.checkpoint!==claim.checkpoint||job.runNumber!==claim.runNumber||job.leaseUntil<=ops.now().toISOString())return {error:'LEASE_STALE'};
 const authority=authorized(ops,job);return {job,...authority};
}
function analyze(ops,job,actor,load){
 const step=job.plan[job.checkpoint],registry=agentRegistry[step.role];requireValue(registry?.tool===step.tool,'TOOL_DENIED','The requested tool is outside this agent scope.',403);
 const resources=kind=>ops.store.list(kind,job.tenantId).filter(r=>r.loadId===load.id);
 let data,explanation;
 if(step.role==='dispatch'){
  const active=resources('assignment').find(a=>a.status==='active');
  const eligible=active?ops.eligibility(actor,active.driverId,active.vehicleId,load,load.id).eligible:null;
  data={assignmentId:active?.id??null,eligible,status:load.status};explanation=active?'Current recorded assignment and carrier eligibility were inspected; no assignment changed.':'No active assignment is recorded; dispatch remains a human action.';
 }else if(step.role==='tracking'){
  const records=resources('tracking'),latest=records.at(-1);
  data={completedStops:load.stops.filter(s=>s.completedAt).length,totalStops:load.stops.length,latestTrackingId:latest?.id??null,latestRecordedAt:latest?.at??null};explanation='Recorded milestone evidence was summarized; no live GPS was inferred.';
 }else if(step.role==='documents'){
  const readiness=shippingDocumentReadiness(ops,actor,load);
  data={ready:readiness.ready,issueCodes:readiness.issues,documentIds:readiness.documentIds,podIds:readiness.podIds};explanation='Document metadata and acknowledgment evidence were checked; no document was approved.';
 }else if(step.role==='exceptions'){
  const open=resources('exception').filter(e=>e.status==='open');
  data={openExceptionIds:open.map(e=>e.id),types:[...new Set(open.map(e=>e.type))]};explanation='Recorded exceptions were summarized; no exception was resolved.';
 }else{
  const invoices=resources('invoice'),readiness=shippingDocumentReadiness(ops,actor,load);
  data={documentReady:readiness.ready,shipmentDelivered:load.status==='delivered',invoiceIds:invoices.map(i=>i.id),invoiceStatuses:invoices.map(i=>i.status)};explanation='Billing readiness was inspected within financial permission; no invoice or payment was generated or approved.';
 }
 return {role:step.role,tool:step.tool,data,explanation,provenance:{provider:'deterministic-rules',version:'1',model:null,live:false},consequentialAction:false};
}
export function executeAdvisory(ops,claim){
 const current=held(ops,claim);requireValue(!current.error,'JOB_AUTHORITY','Job authority or lease changed.',409);
 requireValue(current.job.kind==='orchestration','JOB_KIND','Only advisory jobs use this executor.');
 return analyze(ops,current.job,current.actor,current.load);
}
function safeOutput(ops,job,actor,load,result){
 if(job.kind==='orchestration'){
  // Never accept injected tool decisions: recompute from current scoped records under the completion lock.
  const canonical=analyze(ops,job,actor,load);
  requireValue(JSON.stringify(result)===JSON.stringify(canonical),'DECISION_STALE','Advisory evidence changed before completion.',409);
  return canonical;
 }
 fields(result,['data','provenance','snapshot']);
 fields(result.provenance,['provider','version','model','source','live']);
 requireValue(job.adapterBinding&&Object.keys(job.adapterBinding).every(key=>result.provenance[key]===job.adapterBinding[key]),'CONNECTOR_PROVENANCE','Connector provenance does not match the server-approved adapter lease.',503);
 requireValue(/^[a-z0-9-]{1,40}$/.test(result.provenance.provider)&&/^[a-zA-Z0-9.-]{1,30}$/.test(result.provenance.version),'CONNECTOR_PROVENANCE','Invalid adapter provenance.',503);
 validateConnectorResult(job.capability,job.input,result.snapshot,result.data);
 requireValue(result.provenance?.live===false&&result.provenance.model===null&&result.provenance.source===job.input.source,'CONNECTOR_PROVENANCE','Connector result must preserve local provenance.',503);
 const current=connectorSnapshot(ops,actor,load,job);
 requireValue(JSON.stringify(current.snapshot)===JSON.stringify(result.snapshot),'CONNECTOR_STALE','Connector source records changed before completion.',409);
 return result;
}
export function completeJob(ops,claim,result){
 return ops.store.transaction(()=>{
  const current=held(ops,claim);
  if(current.error==='LEASE_STALE')return {accepted:false,reason:current.error};
  const {job}=current;
  if(current.error){writeJob(ops,job,{status:'blocked',lastError:current.error,leaseOwner:null,leaseUntil:null,fence:job.fence+1},'runtime:blocked',current.error);return {accepted:false,reason:current.error};}
  let output;try{output=safeOutput(ops,job,current.actor,current.load,result)}catch{writeJob(ops,job,{status:'blocked',lastError:'EVIDENCE_CHANGED',leaseOwner:null,leaseUntil:null,fence:job.fence+1},'runtime:blocked','EVIDENCE_CHANGED');return {accepted:false,reason:'EVIDENCE_CHANGED'};}
  const evidence=ops.store.insert(job.kind==='orchestration'?'agentdecision':'connectorresult',job.tenantId,{loadId:job.loadId,loadVersion:job.loadVersion,jobId:job.id,runNumber:job.runNumber,checkpoint:job.checkpoint,fence:job.fence,policyVersion:current.policyVersion,...output,createdAt:ops.now().toISOString()});
  ops.store.audit(service(job.tenantId),'runtime:decision',evidence.id,'success',{jobId:job.id,loadId:job.loadId,role:output.role??null,tool:tool(job),checkpoint:job.checkpoint,fence:job.fence,provider:output.provenance.provider,model:null,consequentialAction:false},ops.now().toISOString());
  const checkpoint=job.checkpoint+1,completed=job.kind==='connectorjob'||checkpoint===job.plan.length;
  const next=writeJob(ops,job,{status:completed?'completed':'pending',checkpoint,attempts:0,lastError:null,nextAttemptAt:null,leaseOwner:null,leaseUntil:null,decisionIds:[...job.decisionIds,evidence.id],...(completed?{completedAt:ops.now().toISOString()}: {})},'runtime:checkpoint');
  return {accepted:true,job:next,evidenceId:evidence.id};
 });
}
export function failJob(ops,claim,error){
 return ops.store.transaction(()=>{
  const current=held(ops,claim);if(current.error==='LEASE_STALE')return {accepted:false,reason:current.error};
  const {job}=current;
  if(current.error){writeJob(ops,job,{status:'blocked',lastError:current.error,leaseOwner:null,leaseUntil:null,fence:job.fence+1},'runtime:blocked',current.error);return {accepted:false,reason:current.error};}
  const retry=error?.transient===true&&job.attempts<3,code=error?.code==='CONNECTOR_TIMEOUT'?'CONNECTOR_TIMEOUT':error?.transient===true?'TRANSIENT_STEP_FAILURE':'STEP_FAILURE';
  const next=writeJob(ops,job,{status:retry?'retry':'dead_letter',lastError:code,leaseOwner:null,leaseUntil:null,nextAttemptAt:retry?new Date(ops.now().getTime()+1000*2**job.attempts).toISOString():null},'runtime:failure',code);
  return {accepted:true,job:next};
 });
}
export async function runRuntimeTick(ops,{workerId='local-'+randomUUID(),adapters,fault,timeoutMs=2000}={}){
 let completed=0;
 for(const tenant of ops.store.db.prepare('SELECT id FROM tenants').all()){
  for(const kind of jobKinds){
   const now=ops.now().toISOString();
   const candidates=ops.store.list(kind,tenant.id).filter(j=>j.status==='pending'||j.status==='retry'&&j.nextAttemptAt<=now||j.status==='running'&&j.leaseUntil<=now).slice(0,20);
   for(const candidate of candidates){
    const claim=claimJob(ops,{tenantId:tenant.id,kind,jobId:candidate.id,workerId,adapters});if(!claim)continue;
    try{
     if(fault)await fault({stage:'after_claim',jobId:claim.jobId,checkpoint:claim.checkpoint});
     const current=held(ops,claim);requireValue(!current.error,'JOB_AUTHORITY','Job authority changed.',409);
     let output;
     if(kind==='orchestration')output=executeAdvisory(ops,claim);
     else{
      const context=connectorSnapshot(ops,current.actor,current.load,current.job);
      output={...await invokeConnector(current.job.capability,{...context,idempotencyKey:current.job.id+':'+current.job.runNumber},{adapters,timeoutMs}),snapshot:context.snapshot};
     }
     if(fault)await fault({stage:'before_complete',jobId:claim.jobId,checkpoint:claim.checkpoint});
     if(completeJob(ops,claim,output).accepted)completed++;
    }catch(error){failJob(ops,claim,error)}
   }
  }
 }
 return completed;
}
export function runtimeState(ops,actor,visibleLoads){
 const ids=new Set(visibleLoads.map(l=>l.id));
 const visible=ops.store.list('load',actor.tenantId).filter(l=>ids.has(l.id)&&can(actor,'load:view',l));
 const loads=new Map(visible.map(l=>[l.id,l]));
 const jobs=kind=>ops.store.list(kind,actor.tenantId).filter(j=>loads.has(j.loadId)&&can(actor,permission(j),loads.get(j.loadId))&&(j.capability!=='accounting'||can(actor,'billing:manage',loads.get(j.loadId))));
 const orchestrations=jobs('orchestration'),connectorjobs=jobs('connectorjob'),orchestrationIds=new Set(orchestrations.map(j=>j.id)),connectorIds=new Set(connectorjobs.map(j=>j.id));
 return {orchestrations,connectorjobs,runtimeTools:can(actor,'governance:manage',safeScope(actor))?governedTools:[],
  agentdecisions:ops.store.list('agentdecision',actor.tenantId).filter(d=>orchestrationIds.has(d.jobId)&&agentRegistry[d.role]?.permissions.every(p=>can(actor,p,loads.get(d.loadId)))),
  connectorresults:ops.store.list('connectorresult',actor.tenantId).filter(r=>connectorIds.has(r.jobId)&&(!r.snapshot?.invoiceId||can(actor,'billing:manage',loads.get(r.loadId)))),
  governancepolicies:can(actor,'governance:manage',safeScope(actor))?ops.store.list('governancepolicy',actor.tenantId):[],
  runtimeDisclosure:'Bounded deterministic advisory agents and local-only adapters. No autonomous dispatch, payment, live GPS, messages, or model inference.'
 };
}
export const runtimeIntegritySQL=`
 CREATE UNIQUE INDEX IF NOT EXISTS one_active_advisory_job ON resources(tenant_id,json_extract(data,'$.loadId')) WHERE kind='orchestration' AND json_extract(data,'$.status') IN ('pending','running','retry');
 CREATE UNIQUE INDEX IF NOT EXISTS one_active_connector_job ON resources(tenant_id,json_extract(data,'$.loadId'),json_extract(data,'$.capability')) WHERE kind='connectorjob' AND json_extract(data,'$.status') IN ('pending','running','retry');
 CREATE UNIQUE INDEX IF NOT EXISTS one_carrier_governance_policy ON resources(tenant_id) WHERE kind='governancepolicy';
 CREATE UNIQUE INDEX IF NOT EXISTS one_agent_checkpoint_decision ON resources(tenant_id,json_extract(data,'$.jobId'),json_extract(data,'$.runNumber'),json_extract(data,'$.checkpoint')) WHERE kind IN ('agentdecision','connectorresult');
 CREATE TRIGGER IF NOT EXISTS runtime_evidence_no_update BEFORE UPDATE ON resources WHEN OLD.kind IN ('agentdecision','connectorresult') BEGIN SELECT RAISE(ABORT,'Runtime evidence is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS runtime_evidence_no_delete BEFORE DELETE ON resources WHEN OLD.kind IN ('agentdecision','connectorresult') BEGIN SELECT RAISE(ABORT,'Runtime evidence is immutable'); END;
`;
