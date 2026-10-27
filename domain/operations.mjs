import {validateConfiguredRecord} from './operations-admin-validation.mjs';
import {authorizeConfigured,projectConfiguredFields} from './operations-admin-policy.mjs';
import {lifecycleState} from './operations-lifecycle.mjs';
import {createAIPolicyExtensions,aiPolicyState} from './operations-ai-policy.mjs';
import {normalizeLoadCreatePayload} from './operations-load-contract.mjs';
import {createHash} from 'node:crypto';
import {authorize,rolePermissions,canDelegatePermission} from './authorization.mjs';
import {OpsError,reject,requireValue,fields,text,integer,utc} from './operations-errors.mjs';
import {projectResult} from './operations-projection.mjs';
import {addUser} from '../server/operations-auth.mjs';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
// Date formatters are immutable for a given tenant timezone; reuse across eligibility checks.
const localDateFormatters=new Map();
function localDateFormatter(timeZone){
 let formatter=localDateFormatters.get(timeZone);
 if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});localDateFormatters.set(timeZone,formatter)}
 return formatter;
}
export class Operations{
 constructor(store,{now=()=>new Date(),extensions={},views=[]}={}){this.store=store;this.now=now;this.extensions={...createAIPolicyExtensions(),...extensions};this.views=[...views,aiPolicyState];}
 actor(id){const a=this.store.principal(id);if(!a?.active)reject(401,'SESSION','Sign in required.');return a;}
 guard(actor,action,resource){if(!authorizeConfigured({store:this.store,actor,action,resource}))reject(403,'FORBIDDEN','This action is not permitted.');}
 read(kind,id,actor,action){const r=this.store.get(kind,id,actor.tenantId);if(action)this.guard(actor,action,r);return r;}
 change(actor,resource,patch,action,reason=''){
  if(['load','shipment'].includes(resource.kind))patch={...patch,lifecycleState:lifecycleState({...resource,...patch})};
  const validation=validateConfiguredRecord(this.store,actor.tenantId,resource.kind,{...resource,...patch});
  requireValue(validation.valid,'VALIDATION_RULE','Configured validation rule rejected this update.',422);
  const next=this.store.update(resource.kind,resource.id,actor.tenantId,resource.version,patch);
  this.store.audit(actor,action,resource.id,'success',{before:resource,after:next,reason},this.now().toISOString());return next;
 }
 create(actor,kind,values,action){
  if(['load','shipment'].includes(kind))values={...values,lifecycleState:lifecycleState(values)};
  const validation=validateConfiguredRecord(this.store,actor.tenantId,kind,values);
  requireValue(validation.valid,'VALIDATION_RULE','Configured validation rule rejected this record.',422);
  const result=this.store.insert(kind,actor.tenantId,values);
  this.store.audit(actor,action,result.id,'success',{after:result},this.now().toISOString());return result;
 }
 version(resource,expected){requireValue(Number.isInteger(expected)&&expected===resource.version,'STALE','Refresh this record before trying again.',409);}
 localDate(actor,value=this.now()){
  return localDateFormatter(this.store.tenant(actor.tenantId).timezone).format(value);
 }
 eligibility(actor,driverId,vehicleId,load,ignoreLoadId=null){
  const driver=this.read('driver',driverId,actor),vehicle=this.read('vehicle',vehicleId,actor);
  const user=this.store.principal(driverId);
  const today=this.localDate(actor);
  // Check availability with a bounded indexed existence lookup, without loading all assignments.
  const free=kind=>{
   const column=kind==='driver'?'driverId':'vehicleId';
   const resourceId=kind==='driver'?driverId:vehicleId;
   const sql=`SELECT 1 FROM resources WHERE kind='assignment' AND tenant_id=? AND json_extract(data,'$.status')='active' AND json_extract(data,'$.loadId') IS NOT ? AND json_extract(data,'$.${column}')=? LIMIT 1`;
   return !this.store.db.prepare(sql).get(actor.tenantId,ignoreLoadId,resourceId);
  };
  const reasons=[];
  if(!user?.active||!driver.active||!driver.available||!driver.approved||driver.compliance!=='valid'||!driver.expiresOn||driver.expiresOn<today)reasons.push('Driver is unavailable or not compliant and carrier-approved.');
  if(!vehicle.active||!vehicle.available||!vehicle.approved||vehicle.maintenance!=='ready')reasons.push('Vehicle is unavailable, needs maintenance, or lacks carrier approval.');
  if(vehicle.capacityLb<load.weightLb)reasons.push('Vehicle capacity is insufficient.');
  if((driver.fleetId??null)!==(vehicle.fleetId??null))reasons.push('Driver and vehicle ownership relationships differ.');
  if(!free('driver')||!free('vehicle'))reasons.push('Driver or vehicle already has an active assignment.');
  return {driver,vehicle,reasons,eligible:reasons.length===0};
 }
 state(userId){
  requireValue(this.actor(userId).role!=='platform','FORBIDDEN','Platform governance has no operations view.',403);
  const actor=this.actor(userId),result={actor,tenant:this.store.tenant(actor.tenantId),mode:'Local persistence; hosted behavior is not certified',capabilities:Object.keys(this.extensions)};
  for(const kind of ['load','shipment','assignment','driver','vehicle','fleet','tracking','exception','workflow','recommendation','approval','invoice']){
   result[kind+'s']=this.store.list(kind,actor.tenantId).filter(record=>{
    if(kind==='fleet')return actor.permissions.includes('fleet:manage')||actor.role==='fleet'&&record.id===actor.fleetId;
    if(kind==='driver'||kind==='vehicle'){
     const assignment=kind==='vehicle'?this.store.list('assignment',actor.tenantId).find(a=>a.vehicleId===record.id&&a.status==='active'):null;
     return authorizeConfigured({store:this.store,actor,action:'asset:view',resource:assignment?{...record,driverId:assignment.driverId}:record});
    }
    if(['driver','fleet','customer'].includes(actor.role)&&['workflow','recommendation','approval'].includes(kind))return false;
    let load=record;
    if(kind!=='load')try{load=this.read('load',record.loadId,actor)}catch{return false}
    return authorizeConfigured({store:this.store,actor,action:'load:view',resource:load})&&(kind!=='invoice'||authorizeConfigured({store:this.store,actor,action:actor.role==='customer'?'invoice:view':'finance:manage',resource:load}));
   }).map(record=>projectConfiguredFields({store:this.store,actor,resource:record,object:kind,record:projectResult(this,actor,record)}));
  }
  if(actor.role==='carrier'&&actor.permissions.includes('user:manage'))result.users=this.store.db.prepare('SELECT data FROM users WHERE tenant_id=?').all(actor.tenantId).map(r=>JSON.parse(r.data));
  else if(actor.role==='fleet'&&actor.permissions.includes('employment:manage'))result.users=this.store.db.prepare('SELECT data FROM users WHERE tenant_id=?').all(actor.tenantId).map(r=>JSON.parse(r.data)).filter(u=>u.fleetId===actor.fleetId&&u.role==='driver');
  else result.users=[];
  if(actor.permissions.includes('audit:view')){
   const visible=new Set(result.loads.map(l=>l.id));
   result.audit=this.store.db.prepare('SELECT sequence,actor_id AS actorId,action,resource_id AS resourceId,at,outcome FROM audit WHERE tenant_id=? ORDER BY sequence DESC LIMIT 200').all(actor.tenantId)
    // Audit payloads remain in the append-only store, never in general workspace state.
    .filter(row=>actor.role==='carrier'||row.actorId===actor.id||visible.has(row.resourceId));
  }else result.audit=[];
  for(const view of this.views)Object.assign(result,view(this,actor,result.loads));
  return result;
 }
 execute(userId,command){
  const actor=this.actor(userId);
  fields(command,['action','resourceId','expectedVersion','idempotencyKey','payload']);
  const action=text(command.action,60),key=text(command.idempotencyKey,100);
  requireValue(/^[a-z]+:[a-z]+$/.test(action)&&/^[a-zA-Z0-9_-]{8,100}$/.test(key),'COMMAND','Invalid command metadata.');
  const hash=digest(command);
  try{return this.store.transaction(()=>{
   const fresh=this.actor(userId);
   const previous=this.store.db.prepare('SELECT digest,result FROM commands WHERE tenant_id=? AND actor_id=? AND key=?').get(fresh.tenantId,fresh.id,key);
   if(previous){requireValue(previous.digest===hash,'IDEMPOTENCY','This request key was used for different input.',409);return projectResult(this,fresh,JSON.parse(previous.result));}
   const result=projectResult(this,fresh,this.perform(fresh,command));
   this.store.db.prepare('INSERT INTO commands VALUES(?,?,?,?,?)').run(fresh.tenantId,fresh.id,key,hash,JSON.stringify(result));
   return result;
  });}catch(e){
   const error=e instanceof OpsError?e:new OpsError(String(e.code).includes('CONSTRAINT')?409:503,'STORAGE','Operation could not be committed.');
   this.store.audit(actor,action,typeof command.resourceId==='string'?command.resourceId.slice(0,100):null,'denied',{code:error.code},this.now().toISOString());
   throw error;
  }
 }
 perform(actor,c){
  const p=c.payload??{},scope={tenantId:actor.tenantId,fleetId:actor.fleetId};
  if(c.action==='customer:create'){
   fields(p,['name']);this.guard(actor,'customer:manage',scope);return this.create(actor,'customer',{name:text(p.name),active:true},c.action);
  }
  if(c.action==='fleet:create'){
   fields(p,['name']);this.guard(actor,'fleet:manage',scope);return this.create(actor,'fleet',{name:text(p.name),active:true},c.action);
  }
  if(c.action==='user:create'){
   requireValue(p.role!=='platform','FORBIDDEN','Platform governance cannot be delegated by carriers.',403);
   fields(p,['username','name','role','fleetId','customerId','password','permissions']);this.guard(actor,'user:manage',scope);
   requireValue(p.role!=='driver'||!p.fleetId,'EMPLOYMENT','Fleet administrators manage their own driver employment.',403);
   const grants=p.permissions??rolePermissions[p.role];
   requireValue(Array.isArray(grants)&&grants.every(permission=>canDelegatePermission(actor,p.role,permission)),'DELEGATION','Account grants exceed your current delegation authority.',403);
   const user=addUser(this.store,{...p,permissions:grants,tenantId:actor.tenantId});
   this.store.audit(actor,c.action,user.id,'success',{role:user.role,fleetId:user.fleetId},this.now().toISOString());return user;
  }
  if(c.action==='driver:create'){
   fields(p,['username','name','password']);this.guard(actor,'employment:manage',scope);
   const user=addUser(this.store,{...p,role:'driver',fleetId:actor.fleetId,tenantId:actor.tenantId});
   this.store.audit(actor,c.action,user.id,'success',{role:user.role,fleetId:user.fleetId},this.now().toISOString());return user;
  }
  if(c.action==='user:deactivate'){
   fields(p,['reason']);this.guard(actor,actor.role==='fleet'?'employment:manage':'user:manage',scope);const reason=text(p.reason,300);
   const user=this.store.principal(c.resourceId);
   requireValue(user?.tenantId===actor.tenantId&&user.id!==actor.id,'USER','Account cannot be deactivated.',403);
   if(actor.role==='fleet')requireValue(user.role==='driver'&&user.fleetId===actor.fleetId,'EMPLOYMENT','Only drivers employed by this fleet can be managed.',403);
   requireValue(user.role!=='platform','FORBIDDEN','Use platform governance for platform accounts.',403);
   const updated={...user,active:false,authVersion:(user.authVersion??0)+1};this.store.db.prepare('UPDATE users SET data=? WHERE id=? AND tenant_id=?').run(JSON.stringify(updated),user.id,actor.tenantId);
   this.store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
   this.store.audit(actor,c.action,user.id,'success',{before:{active:user.active},after:{active:false},reason},this.now().toISOString());return updated;
  }
  if(c.action==='vehicle:create'){
   fields(p,['name','capacityLb','fleetId']);const fleetId=actor.role==='fleet'?actor.fleetId:(p.fleetId||null);
   this.guard(actor,'asset:manage',{...scope,fleetId});
   if(fleetId)requireValue(this.read('fleet',fleetId,actor).active,'FLEET','Fleet is inactive.');
   return this.create(actor,'vehicle',{name:text(p.name),capacityLb:integer(p.capacityLb,1,200000),fleetId,ownerType:fleetId?'fleet':'carrier',ownerId:fleetId??actor.tenantId,approved:false,maintenance:'ready',active:true,available:true},c.action);
  }
  if(['driver:update','vehicle:update','driver:approve','vehicle:approve'].includes(c.action)){
   const kind=c.action.split(':')[0],approval=c.action.endsWith(':approve');
   fields(p,approval?['approved','reason']:kind==='driver'?['available','active','compliance','expiresOn','reason']:['available','active','maintenance','reason']);
   const r=this.read(kind,c.resourceId,actor,approval?c.action:'asset:manage');this.version(r,c.expectedVersion);
   const patch={};const reason=text(p.reason,300);
   if(approval){requireValue(typeof p.approved==='boolean','APPROVAL','Choose an approval decision.');patch.approved=p.approved;}
   else{
    for(const field of ['available','active'])if(p[field]!==undefined){requireValue(typeof p[field]==='boolean','BOOLEAN','Expected true or false.');patch[field]=p[field];}
    if(kind==='driver'){
     if(p.compliance!==undefined){requireValue(actor.role==='carrier','COMPLIANCE','Only the carrier changes compliance.',403);requireValue(['valid','critical'].includes(p.compliance),'COMPLIANCE','Invalid compliance state.');patch.compliance=p.compliance;}
     if(p.expiresOn!==undefined){requireValue(actor.role==='carrier','COMPLIANCE','Only the carrier records verified expiry.',403);requireValue(/^\d{4}-\d{2}-\d{2}$/.test(p.expiresOn)&&Number.isFinite(Date.parse(p.expiresOn))&&new Date(p.expiresOn).toISOString().slice(0,10)===p.expiresOn,'EXPIRY','Enter a valid expiry date.');patch.expiresOn=p.expiresOn;}
    }else if(p.maintenance!==undefined){requireValue(['ready','due','out_of_service'].includes(p.maintenance),'MAINTENANCE','Invalid maintenance state.');patch.maintenance=p.maintenance;}
   }
   return this.change(actor,r,patch,c.action,reason);
  }
  if(c.action==='load:create'){
   this.guard(actor,'load:create',scope);
   const normalized=normalizeLoadCreatePayload(p);
   if(normalized.customerId)requireValue(this.read('customer',normalized.customerId,actor).active,'CUSTOMER','Select an active customer.');
   const dispatcher=this.store.principal(normalized.dispatcherId);
   requireValue(dispatcher?.tenantId===actor.tenantId&&dispatcher.role==='dispatcher'&&dispatcher.active,'DISPATCHER','Select an active carrier dispatcher.');
   const load=this.create(actor,'load',{...normalized,dispatcherId:dispatcher.id,status:'draft',driverId:null,vehicleId:null,fleetId:null,createdAt:this.now().toISOString()},c.action);
   this.create(actor,'shipment',{loadId:load.id,dispatcherId:dispatcher.id,driverId:null,fleetId:null,commodity:load.commodity,weightLb:load.weightLb,stops:load.stops,status:'draft'},'shipment:create');
   return load;
  }
  if(['load:validate','load:assign','load:accept','load:pickup','load:transit','load:deliver','load:void'].includes(c.action)){
   const permission=c.action==='load:validate'?'load:validate':['load:assign','load:void'].includes(c.action)?'load:dispatch':'load:execute';
   const load=this.read('load',c.resourceId,actor,permission);this.version(load,c.expectedVersion);
   let patch={},reason='';
   if(['load:pickup','load:transit'].includes(c.action)){const check=this.eligibility(actor,load.driverId,load.vehicleId,load,load.id);requireValue(check.eligible,'INELIGIBLE',check.reasons.join(' '),409);}
   if(c.action==='load:validate'){fields(p,[]);requireValue(load.status==='draft','TRANSITION','Only draft loads can be validated.',409);patch.status='validated';}
   if(c.action==='load:assign'){
    fields(p,['driverId','vehicleId','reason']);reason=text(p.reason,300);
    requireValue(['validated','assigned','accepted'].includes(load.status),'TRANSITION','Assignment cannot change after pickup.',409);
    const eligible=this.eligibility(actor,p.driverId,p.vehicleId,load,load.id);requireValue(eligible.eligible,'INELIGIBLE',eligible.reasons.join(' '),409);
    for(const a of this.store.list('assignment',actor.tenantId).filter(x=>x.loadId===load.id&&x.status==='active'))this.change(actor,a,{status:'ended',endedAt:this.now().toISOString()},'assignment:end',reason);
    this.create(actor,'assignment',{loadId:load.id,driverId:p.driverId,vehicleId:p.vehicleId,fleetId:eligible.driver.fleetId,status:'active',acceptedAt:null,createdAt:this.now().toISOString()},'assignment:create');
    patch={status:'assigned',driverId:p.driverId,vehicleId:p.vehicleId,fleetId:eligible.driver.fleetId};
   }
   if(c.action==='load:accept'){
    fields(p,[]);requireValue(load.status==='assigned','TRANSITION','Only assigned loads can be accepted.',409);
    const eligible=this.eligibility(actor,load.driverId,load.vehicleId,load,load.id);requireValue(eligible.eligible,'INELIGIBLE',eligible.reasons.join(' '),409);patch.status='accepted';
    const a=this.store.list('assignment',actor.tenantId).find(a=>a.loadId===load.id&&a.status==='active');this.change(actor,a,{acceptedAt:this.now().toISOString()},'assignment:accept');
   }
   if(c.action==='load:pickup'||c.action==='load:deliver'){
    fields(p,c.action==='load:pickup'?['stopId']:['stopId','proofReference']);
    const pickup=c.action==='load:pickup';requireValue(pickup?load.status==='accepted':load.status==='in_transit','TRANSITION','This stop cannot be completed in the current state.',409);
    const open=this.store.list('exception',actor.tenantId).some(e=>e.loadId===load.id&&e.status==='open');
    requireValue(!open,'EXCEPTION','Resolve open exceptions before completing the stop.',409);
    const next=load.stops.find(s=>!s.completedAt);
    requireValue(next?.id===p.stopId&&next.type===(pickup?'pickup':'delivery'),'STOP_ORDER','Complete the next scheduled stop.',409);
    const stops=load.stops.map(s=>s.id===next.id?{...s,completedAt:this.now().toISOString(),...(!pickup?{proofReference:text(p.proofReference,120)}:{})}:s);
    patch.stops=stops;
    if(pickup&&stops.filter(s=>s.type==='pickup').every(s=>s.completedAt))patch.status='picked_up';
    if(!pickup&&stops.every(s=>s.completedAt)){patch.status='delivered';patch.deliveredAt=this.now().toISOString();}
   }
   if(c.action==='load:transit'){fields(p,[]);requireValue(!this.store.list('exception',actor.tenantId).some(e=>e.loadId===load.id&&e.status==='open'),'EXCEPTION','Resolve open exceptions before starting transit.',409);requireValue(load.status==='picked_up','TRANSITION','Pickup must be completed first.',409);patch.status='in_transit';}
   if(c.action==='load:void'){fields(p,['reason']);requireValue(['draft','validated','assigned','accepted'].includes(load.status),'TRANSITION','Started or completed loads cannot be voided.',409);reason=text(p.reason,300);patch.status='void';}
   const updated=this.change(actor,load,patch,c.action,reason);
   const shipment=this.store.list('shipment',actor.tenantId).find(s=>s.loadId===load.id);
   this.change(actor,shipment,{status:updated.status,stops:updated.stops,driverId:updated.driverId,fleetId:updated.fleetId},'shipment:transition',reason);
   if(['delivered','void'].includes(updated.status))for(const a of this.store.list('assignment',actor.tenantId).filter(a=>a.loadId===load.id&&a.status==='active'))this.change(actor,a,{status:'ended',endedAt:this.now().toISOString()},'assignment:end');
   return updated;
  }
  if(this.extensions[c.action])return this.extensions[c.action](this,actor,c);
  reject(404,'ACTION','Unknown operation.');
 }
}
