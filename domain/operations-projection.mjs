import {authorize} from './authorization.mjs';
import {requireValue} from './operations-errors.mjs';
const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>object[k]!==undefined).map(k=>[k,object[k]]));
export function projectResult(ops,actor,value){
 if(Array.isArray(value))return value.map(v=>projectResult(ops,actor,v));
 if(!value||typeof value!=='object')return value;
 if(value.kind&&value.loadId){const related=ops.read('load',value.loadId,actor);ops.guard(actor,({document:'document:view',pod:'document:view',invoice:actor.role==='customer'?'invoice:view':'finance:manage',payment:'billing:manage',operationcost:'cost:manage',routeevaluation:'intelligence:view',risk:'intelligence:view',capacityproposal:'intelligence:view',orchestration:'orchestration:manage',connectorjob:'connector:request'})[value.kind]??'load:view',related);}
 if(value.kind==='load'||value.kind==='shipment'){
  const load=value.kind==='load'?ops.store.get('load',value.id,actor.tenantId):ops.store.get('load',value.loadId,actor.tenantId);
  ops.guard(actor,'load:view',load);
  if(actor.role==='customer')return pick(value,['id','kind','tenantId','version','loadId','reference','commodity','weightLb','status','stops','createdAt','deliveredAt']);
  if(['driver','fleet'].includes(actor.role)){const {rateCents,charges,customer,customerId,factorName,factored,...safe}=value;return safe;}
 }
 if(value.kind==='connectorjob'&&value.capability==='accounting'||value.kind==='connectorresult'&&value.snapshot?.invoiceId||value.kind==='agentdecision'&&value.role==='finance'){ops.guard(actor,'billing:manage',ops.read('load',value.loadId,actor));}
 if(value.kind==='document'){const {content,extracted,extractedFields,...safe}=value;return safe;}
 if(value.kind==='invoice'&&actor.role==='customer')return pick(value,['id','kind','version','loadId','status','currency','totalCents','dueOn','createdAt','issuedAt','paidCents','outstandingCents','invoiceReference']);
 if(value.role&&value.permissions&&value.id!==actor.id)requireValue(actor.permissions.includes('user:manage')||actor.role==='fleet'&&actor.permissions.includes('employment:manage')&&value.role==='driver'&&value.fleetId===actor.fleetId,'FORBIDDEN','Account visibility is not permitted.',403);
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,projectResult(ops,actor,v)]));
}
