import {randomUUID} from 'node:crypto';
import {authorize} from '../domain/authorization.mjs';
const routes=new Set(['/api/ops/feedback','/api/ops/login','/api/ops/logout','/api/ops/commands','/api/ops/state','/api/ops/health','/health','/app','/portal','/login','/']);
export const routeClass=path=>routes.has(path)?path:path?.startsWith('/assets/')?'asset':path?.startsWith('/api/ops/documents/')?'document':'other';
export function failureClass(status){return status>=500?'availability':status===401?'authentication':status===403?'authorization':status===409?'conflict':status===429?'rate_limit':status>=400?'validation':'none';}
export function observeRequest(req,res,{sink=()=>{},now=()=>performance.now()}={}){
 const correlationId=randomUUID(),started=now();res.setHeader('X-Correlation-ID',correlationId);
 let route='other';try{route=routeClass(new URL(req.url,'http://localhost').pathname)}catch{}
 res.once('finish',()=>{
  const event={version:1,event:'http_request',correlationId,route,method:['GET','HEAD','POST'].includes(req.method)?req.method:'other',status:res.statusCode,category:failureClass(res.statusCode),durationMs:Math.max(0,Math.round((now()-started)*1000)/1000)};
  try{sink(event)}catch{/* Diagnostic sink failure must not change an already committed operation. */}
 });return correlationId;
}
export function workflowHealth(ops,actor,visibleLoads){
 if(!authorize({actor,action:'orchestration:manage',resource:{tenantId:actor.tenantId}}))return {workflowHealth:null};
 const ids=new Set(visibleLoads.filter(l=>authorize({actor,action:'load:view',resource:l})).map(l=>l.id)),now=ops.now().toISOString();
 const jobs=['orchestration','connectorjob','workflow'].flatMap(kind=>ops.store.list(kind,actor.tenantId)).filter(j=>ids.has(j.loadId));
 const counts={pending:0,running:0,retry:0,deadLetter:0,blocked:0,expiredLease:0};let oldest=0;
 for(const j of jobs){
  if(j.status==='pending')counts.pending++;if(j.status==='running')counts.running++;if(j.status==='retry')counts.retry++;
  if(['dead_letter','failed'].includes(j.status))counts.deadLetter++;if(j.status==='blocked')counts.blocked++;
  if(j.status==='running'&&j.leaseUntil<=now)counts.expiredLease++;
  if(['pending','retry','running'].includes(j.status))oldest=Math.max(oldest,Math.max(0,Date.parse(now)-Date.parse(j.createdAt)));
 }
 const alerts=[];if(counts.deadLetter)alerts.push({code:'DEAD_LETTER',severity:'warning',count:counts.deadLetter,action:'Review the failure and explicitly reauthorize after correcting its cause.'});
 if(counts.blocked)alerts.push({code:'AUTHORITY_OR_POLICY',severity:'warning',count:counts.blocked,action:'Review current permissions, shipment evidence and carrier policy.'});
 if(counts.expiredLease)alerts.push({code:'LEASE_EXPIRED',severity:'warning',count:counts.expiredLease,action:'Check worker health; a new claim must advance the fencing token.'});
 if(oldest>300000)alerts.push({code:'QUEUE_AGE',severity:'warning',action:'Investigate advisory work pending for more than five minutes.'});
 return {workflowHealth:{asOf:now,scope:'authorized visible shipments',counts,oldestPendingMs:oldest,alerts,status:alerts.length?'attention':'ok',externalAlertDelivery:false}};
}
