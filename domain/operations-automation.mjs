import {fields,text,requireValue,integer,OpsError} from './operations-errors.mjs';

const activeStatuses=['accepted','picked_up','in_transit'];
function workflowLoad(ops,actor,workflow){return ops.read('load',workflow.loadId,actor,'workflow:run');}
function failReview(ops,actor,w,code){
 for(const a of ops.store.list('approval',actor.tenantId).filter(a=>a.workflowId===w.id&&['pending','approved'].includes(a.status)))ops.change(actor,a,{status:code==='EXPIRED'?'expired':'stale'},'approval:invalidate',code);
 return ops.change(actor,w,{status:'failed',lastError:code},'workflow:failed',code);
}
export function payWeek(instant,timezone){
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
 const day=new Date(local+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));return day.toISOString().slice(0,10);
}
export function createAutomation({step=()=>{}}={}){
 function advance(ops,actor,c){
  fields(c.payload??{},[]);
  let w=ops.read('workflow',c.resourceId,actor);ops.version(w,c.expectedVersion);
  const load=workflowLoad(ops,actor,w),now=ops.now().toISOString();
  if(w.status==='waiting_approval'){
   const a=ops.store.list('approval',actor.tenantId).find(a=>a.workflowId===w.id&&a.status==='pending');
   if(!a||a.loadVersion!==load.version)return failReview(ops,actor,w,'STALE');
   if(a.expiresAt<=now)return failReview(ops,actor,w,'EXPIRED');
   return w;
  }
  requireValue(['pending','retry','approved'].includes(w.status),'WORKFLOW_STATE','This workflow cannot advance.',409);
  if(w.status==='retry')requireValue(w.nextAttemptAt<=now,'RETRY_EARLY','Wait until the retry time.',409);
  if(w.status==='approved'){
   const a=ops.store.list('approval',actor.tenantId).find(a=>a.id===w.approvalId&&a.status==='approved');
   if(!a||a.loadVersion!==load.version||a.expiresAt<=now)return failReview(ops,actor,w,a?.expiresAt<=now?'EXPIRED':'STALE');
   const recommendation=ops.read('recommendation',a.recommendationId,actor);
   const exception=ops.read('exception',w.exceptionId,actor);
   if(recommendation.action==='resume_after_review'){
    const eligibility=ops.eligibility(actor,load.driverId,load.vehicleId,load,load.id);
    if(!eligibility.eligible)return failReview(ops,actor,w,'INELIGIBLE');
    ops.change(actor,exception,{status:'resolved',resolvedAt:now,approvalId:a.id},'exception:resolve','Human-reviewed resolution');
   }
   ops.change(actor,a,{status:'applied',appliedAt:now},'approval:apply');
   return ops.change(actor,w,{status:'completed',checkpoint:'complete',completedAt:now,lastError:null},'workflow:complete');
  }
  requireValue(activeStatuses.includes(load.status),'TRANSITION','Only active shipments can be reviewed.',409);
  // The injectable step is an internal test seam. Request payloads cannot select code or providers.
  try{step({workflow:w,load});}catch(error){
   const attempts=w.attempts+1,retry=error?.transient===true&&attempts<3;
   return ops.change(actor,w,{attempts,status:retry?'retry':'failed',lastError:retry?'TRANSIENT':'STEP_FAILED',nextAttemptAt:retry?new Date(ops.now().getTime()+1000*2**attempts).toISOString():null},'workflow:stepfailed','Step did not complete; no consequence was applied');
  }
  const exception=ops.read('exception',w.exceptionId,actor);
  requireValue(exception.status==='open','EXCEPTION_STATE','Exception is already resolved.',409);
  const eligibility=ops.eligibility(actor,load.driverId,load.vehicleId,load,load.id);
  const canResume=eligibility.eligible;
  const recommendation=ops.create(actor,'recommendation',{loadId:load.id,workflowId:w.id,source:'rules',model:null,action:canResume?'resume_after_review':'hold_for_repair',
   explanation:canResume?'Carrier-approved driver and vehicle remain eligible. A manager must confirm the reported '+exception.type+' is resolved before resuming.':'Continue holding the shipment: '+eligibility.reasons.join(' '),
   evidence:{exceptionId:exception.id,exceptionVersion:exception.version,loadVersion:load.version,driverVersion:eligibility.driver.version,vehicleVersion:eligibility.vehicle.version,reasons:eligibility.reasons},createdAt:now},'recommendation:create');
  const approval=ops.create(actor,'approval',{loadId:load.id,workflowId:w.id,recommendationId:recommendation.id,loadVersion:load.version,status:'pending',requestedBy:w.requestedBy,createdAt:now,expiresAt:new Date(ops.now().getTime()+30*60000).toISOString()},'approval:request');
  return ops.change(actor,w,{approvalId:approval.id,status:'waiting_approval',checkpoint:'human_review',attempts:w.attempts+1,lastError:null,nextAttemptAt:null},'workflow:checkpoint');
 }
 return {
  'tracking:record':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['location','note']);const load=ops.read('load',c.resourceId,actor,'tracking:create');ops.version(load,c.expectedVersion);
   requireValue(activeStatuses.includes(load.status),'TRANSITION','Tracking requires an active shipment.',409);
   return ops.create(actor,'tracking',{loadId:load.id,location:text(p.location),note:text(p.note,500),at:ops.now().toISOString(),recordedBy:actor.id},c.action);
  },
  'exception:report':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['type','reason']);const load=ops.read('load',c.resourceId,actor,'exception:create');ops.version(load,c.expectedVersion);
   requireValue(activeStatuses.includes(load.status),'TRANSITION','Exceptions require an active shipment.',409);
   requireValue(['delay','breakdown','cargo','weather'].includes(p.type),'EXCEPTION_TYPE','Select a supported exception.');
   const exception=ops.create(actor,'exception',{loadId:load.id,type:p.type,reason:text(p.reason,500),status:'open',reportedBy:actor.id,at:ops.now().toISOString()},c.action);
   ops.create(actor,'workflow',{loadId:load.id,exceptionId:exception.id,status:'pending',checkpoint:'recommend',attempts:0,requestedBy:actor.id,nextAttemptAt:null,createdAt:ops.now().toISOString()},'workflow:start');
   return exception;
  },
  'workflow:advance':advance,
  'workflow:restart':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['reason']);const reason=text(p.reason,300),w=ops.read('workflow',c.resourceId,actor);ops.version(w,c.expectedVersion);workflowLoad(ops,actor,w);
   requireValue(['failed','completed'].includes(w.status),'WORKFLOW_STATE','Only finished reviews can be restarted.',409);
   const exception=ops.read('exception',w.exceptionId,actor);requireValue(exception.status==='open','EXCEPTION_STATE','Resolved exceptions cannot be restarted.',409);
   return ops.change(actor,w,{status:'pending',checkpoint:'recommend',attempts:0,lastError:null,nextAttemptAt:null},c.action,reason);
  },
  'approval:decide':(ops,actor,c)=>{
   const p=c.payload??{};fields(p,['decision','reason']);requireValue(['approved','rejected'].includes(p.decision),'APPROVAL','Select a decision.');const reason=text(p.reason,500);
   const a=ops.read('approval',c.resourceId,actor),load=ops.read('load',a.loadId,actor,'approval:decide');ops.version(a,c.expectedVersion);
   requireValue(a.status==='pending','APPROVAL_STATE','This approval was already decided.',409);
   requireValue(a.requestedBy!==actor.id,'SEPARATION','A different carrier manager must review this request.',403);
   requireValue(a.expiresAt>ops.now().toISOString(),'EXPIRED','This approval expired.',409);
   requireValue(a.loadVersion===load.version,'STALE','Shipment changed; request a new review.',409);
   const w=ops.read('workflow',a.workflowId,actor);requireValue(w.status==='waiting_approval','WORKFLOW_STATE','Review is no longer pending.',409);
   const result=ops.change(actor,a,{status:p.decision,decidedBy:actor.id,decidedAt:ops.now().toISOString(),reason},c.action,reason);
   ops.change(actor,w,{status:p.decision==='approved'?'approved':'failed',checkpoint:p.decision==='approved'?'apply_review':'human_review',lastError:p.decision==='rejected'?'REJECTED':null},'workflow:decision',reason);
   return result;
  },
  'finance:prepare':(ops,actor,c)=>{
   fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'finance:manage');ops.version(load,c.expectedVersion);
   requireValue(load.status==='delivered','INVOICE_STATE','Only delivered loads are invoice-ready.',409);
   requireValue(!ops.store.list('invoice',actor.tenantId).some(i=>i.loadId===load.id),'INVOICE_EXISTS','This load already has a financial record.',409);
   const firstPickup=load.stops.find(s=>s.type==='pickup')?.completedAt;requireValue(!!firstPickup,'PICKUP','A completed pickup is required.');
   const totalCents=load.charges.reduce((total,c)=>total+c.amountCents,load.rateCents);integer(totalCents,0,Number.MAX_SAFE_INTEGER);
   return ops.create(actor,'invoice',{loadId:load.id,loadVersion:load.version,status:'ready',currency:'USD',baseCents:load.rateCents,charges:load.charges,totalCents,billTo:load.factored?load.factorName:load.customer,factored:load.factored,payWeek:payWeek(firstPickup,ops.store.tenant(actor.tenantId).timezone),createdAt:ops.now().toISOString()},c.action);
  },
  'finance:approve':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),invoice=ops.read('invoice',c.resourceId,actor);ops.read('load',invoice.loadId,actor,'finance:manage');ops.version(invoice,c.expectedVersion);
   requireValue(invoice.status==='ready','INVOICE_STATE','Only ready financial records can be approved.',409);
   return ops.change(actor,invoice,{status:'approved',approvedBy:actor.id,approvedAt:ops.now().toISOString()},c.action,reason);
  }
 };
}
// A server-owned service actor can run checkpoints, never decide approvals or change commercial terms.
export function runWorkflowTick(ops){
 const tenants=ops.store.db.prepare('SELECT id FROM tenants').all();let progressed=0;
 for(const tenant of tenants){
  const actor={id:'workflow-service',tenantId:tenant.id,role:'automation',active:true,permissions:['workflow:run']};
  const candidates=ops.store.list('workflow',tenant.id).filter(w=>['pending','approved','waiting_approval'].includes(w.status)||w.status==='retry'&&w.nextAttemptAt<=ops.now().toISOString()).slice(0,50);
  for(const candidate of candidates)ops.store.transaction(()=>{
   const w=ops.read('workflow',candidate.id,actor);
   if(w.version!==candidate.version)return;
   try{
    const result=ops.extensions['workflow:advance'](ops,actor,{resourceId:w.id,expectedVersion:w.version,payload:{}});
    if(result.version!==w.version)progressed++;
   }catch(error){
    if(!(error instanceof OpsError))throw error;
    failReview(ops,actor,w,error.code);progressed++;
   }
  });
 }
 return progressed;
}
