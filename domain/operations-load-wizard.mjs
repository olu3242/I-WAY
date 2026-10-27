import {fields,text,integer,requireValue} from './operations-errors.mjs';
import {normalizeLoadCreatePayload} from './operations-load-contract.mjs';
// Drafts are server-side, tenant scoped and never cached on a shared device.
export function loadDraftData(p){
 fields(p,['reference','customer','customerId','dispatcherId','commodity','weightLb','stops','rateCents','charges','factored','factorName','dimensions','privateNotes','billTo','paymentTerms']);
 requireValue(Buffer.byteLength(JSON.stringify(p))<=20000,'DRAFT_SIZE','The draft is too large.');
 const result={};
 for(const key of ['reference','customer','customerId','dispatcherId','commodity','factorName','dimensions','privateNotes','billTo','paymentTerms'])if(p[key]!==undefined){if(p[key]===null&&['customerId','factorName'].includes(key))continue;requireValue(typeof p[key]==='string'&&p[key].length<=(key==='privateNotes'?1000:120),'DRAFT','Invalid draft text.');result[key]=p[key];}
 for(const key of ['weightLb','rateCents'])if(p[key]!==undefined)result[key]=integer(p[key],0,key==='weightLb'?200000:Number.MAX_SAFE_INTEGER);
 if(p.factored!==undefined){requireValue(typeof p.factored==='boolean','DRAFT','Choose a billing option.');result.factored=p.factored;}
 if(p.stops!==undefined){requireValue(Array.isArray(p.stops)&&p.stops.length>=2&&p.stops.length<=20,'STOPS','Use two to twenty stops.');result.stops=p.stops.map(s=>{fields(s,['type','location','at','windowEnd','privateNotes','facilityId']);requireValue(['pickup','delivery'].includes(s.type),'STOP','Invalid stop type.');for(const [k,v]of Object.entries(s))requireValue(typeof v==='string'&&v.length<=(k==='privateNotes'?1000:120),'STOP','Invalid stop details.');return {...s};});}
 if(p.charges!==undefined){requireValue(Array.isArray(p.charges)&&p.charges.length<=20,'CHARGES','Use at most twenty charges.');result.charges=p.charges.map(x=>{fields(x,['label','amountCents']);return {label:text(x.label,80),amountCents:integer(x.amountCents)};});}
 return result;
}
export function createLoadWizardExtensions(){return {
 'directory:deactivate':(ops,actor,c)=>{fields(c.payload??{},['reason']);const reason=text(c.payload.reason,300),row=ops.read('directoryentry',c.resourceId,actor,'customer:manage');ops.version(row,c.expectedVersion);return ops.change(actor,row,{active:false},c.action,reason);},
 'loaddraft:save':(ops,actor,c)=>{
  fields(c.payload??{},['data','stage','advance','flowVersion']);ops.guard(actor,'load:create',{tenantId:actor.tenantId});
  const flowVersion=c.payload.flowVersion??1;requireValue([1,2].includes(flowVersion),'DRAFT_FLOW','Unsupported draft flow.');
  const patch={data:loadDraftData(c.payload.data),stage:integer(c.payload.stage,0,flowVersion===2?3:4),flowVersion,updatedAt:ops.now().toISOString()};
  if(flowVersion===2&&c.payload.advance===true){
   const d=patch.data;text(d.reference,40);text(d.customer);text(d.commodity);integer(d.weightLb,1,200000);
   const dispatcher=ops.store.principal(d.dispatcherId);requireValue(dispatcher?.active&&dispatcher.role==='dispatcher'&&dispatcher.tenantId===actor.tenantId,'DISPATCHER','Choose an active dispatcher.');
   if(d.customerId)requireValue(ops.read('customer',d.customerId,actor).active,'CUSTOMER','Choose an active customer.');
   if(patch.stage>=1)normalizeLoadCreatePayload({...d,rateCents:patch.stage>=2?d.rateCents:0,charges:patch.stage>=2?d.charges:[],factored:patch.stage>=2?d.factored:false});
   if(patch.stage>=2){text(d.paymentTerms,80);if(!d.factored)text(d.billTo);}
  }
  if(flowVersion===1&&c.payload.advance===true){const d=patch.data;text(d.reference,40);text(d.customer);const dispatcher=ops.store.principal(d.dispatcherId);requireValue(dispatcher?.active&&dispatcher.role==='dispatcher'&&dispatcher.tenantId===actor.tenantId,'DISPATCHER','Choose an active dispatcher.');if(patch.stage>=1)normalizeLoadCreatePayload({...d,commodity:patch.stage>=2?d.commodity:'Draft cargo',weightLb:patch.stage>=2?d.weightLb:1,rateCents:patch.stage>=2?d.rateCents:0,factored:patch.stage>=3?d.factored:false});if(patch.stage>=3){text(d.paymentTerms,80);if(!d.factored)text(d.billTo);}}
  if(!c.resourceId)return ops.create(actor,'loaddraft',{...patch,status:'draft',createdBy:actor.id},c.action);
  const row=ops.read('loaddraft',c.resourceId,actor,'load:create');ops.version(row,c.expectedVersion);requireValue(row.status==='draft','DRAFT','This draft has already been submitted.',409);return ops.change(actor,row,patch,c.action);
 },
 'loaddraft:submit':(ops,actor,c)=>{
  fields(c.payload??{},[]);const row=ops.read('loaddraft',c.resourceId,actor,'load:create');ops.version(row,c.expectedVersion);requireValue(row.status==='draft','DRAFT','This draft has already been submitted.',409);
  normalizeLoadCreatePayload(row.data); // Validate every field again, independent of UI stages.
  if(row.flowVersion===2){text(row.data.paymentTerms,80);if(!row.data.factored)text(row.data.billTo);}
  const payload={...row.data};const load=ops.perform(actor,{action:'load:create',payload});
  ops.change(actor,row,{status:'submitted',loadId:load.id,submittedAt:ops.now().toISOString()},c.action);return load;
 },
 'load:edit':(ops,actor,c)=>{
  fields(c.payload??{},['data','reason']);const reason=text(c.payload.reason,300),load=ops.read('load',c.resourceId,actor,'load:create');ops.version(load,c.expectedVersion);
  requireValue(['draft','validated'].includes(load.status)&&!load.driverId,'TRANSITION','Edit before assignment. Unassign first; executed loads are protected.',409);
  const data=normalizeLoadCreatePayload(c.payload.data),dispatcher=ops.store.principal(data.dispatcherId);
  requireValue(dispatcher?.active&&dispatcher.tenantId===actor.tenantId&&dispatcher.role==='dispatcher','DISPATCHER','Choose an active dispatcher.');
  if(data.customerId)requireValue(ops.read('customer',data.customerId,actor).active,'CUSTOMER','Choose an active customer.');
  const updated=ops.change(actor,load,{...data,status:'draft',readyAt:null},c.action,reason),shipment=ops.store.list('shipment',actor.tenantId).find(s=>s.loadId===load.id);
  requireValue(shipment,'SHIPMENT','Shipment is missing.',409);ops.change(actor,shipment,{dispatcherId:data.dispatcherId,stops:data.stops,commodity:data.commodity,weightLb:data.weightLb,status:'draft',readyAt:null},'shipment:correct',reason);return updated;
 },
 'directory:create':(ops,actor,c)=>{const p=c.payload??{};fields(p,['type','name','address','timezone']);ops.guard(actor,'customer:manage',{tenantId:actor.tenantId});requireValue(['broker','factor','facility'].includes(p.type),'DIRECTORY','Choose a directory type.');const timezone=text(p.timezone,80);try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{requireValue(false,'TIMEZONE','Choose a valid time zone.');}return ops.create(actor,'directoryentry',{type:p.type,name:text(p.name),address:text(p.address,300),timezone,active:true},c.action);}
};}
export function loadWizardState(ops,actor){const allowed=actor.role==='carrier'&&actor.permissions.includes('load:create');return {loaddrafts:allowed?ops.store.list('loaddraft',actor.tenantId).filter(d=>d.status==='draft'):[],directoryentries:actor.role==='carrier'&&actor.permissions.includes('customer:manage')?ops.store.list('directoryentry',actor.tenantId):[]};}
