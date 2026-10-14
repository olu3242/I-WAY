import {authorize} from './authorization.mjs';
import {requireValue} from './operations-errors.mjs';
const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>object[k]!==undefined).map(k=>[k,object[k]]));
export function projectResult(ops,actor,value){
 if(Array.isArray(value))return value.map(v=>projectResult(ops,actor,v));
 if(!value||typeof value!=='object')return value;
 if(value.kind&&value.loadId){const related=ops.read('load',value.loadId,actor,'load:view');ops.guard(actor,({document:'document:view',pod:'document:view',invoice:actor.role==='customer'?'invoice:view':'finance:manage',payment:'billing:manage',operationcost:'cost:manage',measurement:'cost:manage',routeevaluation:'intelligence:view',risk:'intelligence:view',capacityproposal:'intelligence:view',orchestration:'orchestration:manage',connectorjob:'connector:request',integrationreceipt:'connector:request',integrationjob:'connector:request',providerrecommendation:'intelligence:view'})[value.kind]??'load:view',related);}
 if(['retentionpolicy','retentionpreview','governanceexport'].includes(value.kind))ops.guard(actor,'governance:manage',{tenantId:value.tenantId});
 if(value.kind==='governanceexport')ops.guard(actor,'audit:view',{tenantId:value.tenantId});
 if(['privacyexport','consentrecord'].includes(value.kind))requireValue(value.tenantId===actor.tenantId&&value.userId===actor.id,'FORBIDDEN','Own account evidence only.',403);
 if(value.kind==='integrationcircuit')ops.guard(actor,'governance:manage',{tenantId:value.tenantId});
 if(['integrationreceipt','integrationjob'].includes(value.kind)&&value.event?.type==='document')ops.guard(actor,'document:view',ops.read('load',value.loadId,actor));
 if(value.kind==='providerrecommendation'&&['document','finance'].includes(value.purpose))ops.guard(actor,'document:view',ops.read('load',value.loadId,actor));
 if(value.kind==='providerrecommendation'&&value.purpose==='finance')ops.guard(actor,'billing:manage',ops.read('load',value.loadId,actor));
 if(value.kind==='governancepolicy')ops.guard(actor,'governance:manage',{tenantId:value.tenantId});
 if(value.kind==='customer')ops.guard(actor,'customer:manage',{tenantId:value.tenantId});
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
