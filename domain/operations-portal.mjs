import {authorize} from './authorization.mjs';
import {projectResult} from './operations-projection.mjs';
export function portalState(ops,actor,loads){
 const result={customers:actor.permissions.includes('customer:manage')?ops.store.list('customer',actor.tenantId):[]};
 if(actor.role==='customer'){
  result.invoices=ops.store.list('invoice',actor.tenantId).filter(i=>loads.some(l=>l.id===i.loadId)&&['issued','partially_paid','paid','void'].includes(i.status)).map(i=>projectResult(ops,actor,i));
  result.drivers=[];result.vehicles=[];result.fleets=[];result.assignments=[];result.exceptions=[];
  result.trackings=resultTracking(ops,actor,loads);
 }
 return result;
}
function resultTracking(ops,actor,loads){
 const ids=new Set(loads.map(l=>l.id));
 return ops.store.list('tracking',actor.tenantId).filter(t=>ids.has(t.loadId)).map(({id,loadId,at})=>({id,loadId,at,note:'Shipment milestone recorded'}));
}
export function scopedResources(ops,actor,loads,kinds){
 const ids=new Set(loads.map(l=>l.id)),result={};
 for(const kind of kinds)result[kind+'s']=ops.store.list(kind,actor.tenantId).filter(r=>ids.has(r.loadId)).map(r=>projectResult(ops,actor,r));
 return result;
}
