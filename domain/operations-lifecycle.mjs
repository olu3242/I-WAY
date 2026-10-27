import {fields,text,requireValue} from './operations-errors.mjs';
import {shippingDocumentReadiness} from './operations-documents.mjs';
// Compatibility projection: existing execution and billing status contracts stay stable.
export function lifecycleState(load){
 if(load.closedAt)return 'closed';
 if(load.status==='validated'&&load.readyAt)return 'ready';
 return ({accepted:'dispatched',picked_up:'dispatched',void:'cancelled'})[load.status]??load.status;
}
export function createLifecycleExtensions(){
 const transition=(ops,actor,load,patch,action,reason='')=>{
  const updated=ops.change(actor,load,patch,action,reason);
  const shipment=ops.store.list('shipment',actor.tenantId).find(s=>s.loadId===load.id);
  requireValue(!!shipment,'SHIPMENT_MISSING','Shipment record is required.',409);
  ops.change(actor,shipment,{status:updated.status,readyAt:updated.readyAt??null,closedAt:updated.closedAt??null,driverId:updated.driverId,fleetId:updated.fleetId},'shipment:transition',reason);
  return updated;
 };
 return {
  'load:reject':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),load=ops.read('load',c.resourceId,actor,'load:execute');ops.version(load,c.expectedVersion);
   requireValue(actor.role==='driver'&&load.driverId===actor.id&&load.status==='assigned','TRANSITION','Only your pending assignment may be rejected.',409);
   const assignment=ops.store.list('assignment',actor.tenantId).find(a=>a.loadId===load.id&&a.status==='active');
   requireValue(!!assignment,'ASSIGNMENT','A current assignment is required.',409);
   ops.change(actor,assignment,{status:'rejected',endedAt:ops.now().toISOString()},'assignment:reject',reason);
   transition(ops,actor,load,{status:'validated',driverId:null,vehicleId:null,fleetId:null},c.action,reason);
   // Receipt remains visible to its driver after the shipment relationship ends.
   return ops.create(actor,'assignmentresponse',{assignmentId:assignment.id,driverId:actor.id,status:'rejected',reason,recordedAt:ops.now().toISOString()},'assignment:response');
  },
  'load:ready':(ops,actor,c)=>{
   fields(c.payload??{},[]);const load=ops.read('load',c.resourceId,actor,'load:dispatch');ops.version(load,c.expectedVersion);
   requireValue(load.status==='validated'&&!load.readyAt,'TRANSITION','Only validated shipments can become ready.',409);
   return transition(ops,actor,load,{readyAt:ops.now().toISOString()},c.action);
  },
  'load:unassign':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),load=ops.read('load',c.resourceId,actor,'load:dispatch');ops.version(load,c.expectedVersion);
   requireValue(['assigned','accepted'].includes(load.status),'TRANSITION','Only assignments before pickup may be cancelled.',409);
   for(const assignment of ops.store.list('assignment',actor.tenantId).filter(a=>a.loadId===load.id&&a.status==='active'))ops.change(actor,assignment,{status:'ended',endedAt:ops.now().toISOString()},'assignment:end',reason);
   return transition(ops,actor,load,{status:'validated',driverId:null,vehicleId:null,fleetId:null},c.action,reason);
  },
  'load:close':(ops,actor,c)=>{
   fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),load=ops.read('load',c.resourceId,actor,'load:dispatch');ops.version(load,c.expectedVersion);
   requireValue(load.status==='delivered'&&!load.closedAt,'TRANSITION','Only delivered shipments may be closed once.',409);
   requireValue(!ops.store.list('exception',actor.tenantId).some(e=>e.loadId===load.id&&e.status==='open'),'OPEN_EXCEPTION','Resolve operational exceptions before closure.',409);
   const evidence=shippingDocumentReadiness(ops,actor,load);
   requireValue(evidence.ready,'CLOSURE_DOCUMENTS','Validated BOL and acknowledged delivery evidence are required.',409);
   return transition(ops,actor,load,{closedAt:ops.now().toISOString(),closedBy:actor.id,closureEvidence:{documentIds:evidence.documentIds,podIds:evidence.podIds}},c.action,reason);
  }
 };
}
