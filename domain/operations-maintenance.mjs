import {fields,text,integer,utc,requireValue} from './operations-errors.mjs';
function vehicleFor(ops,actor,id,permission){
 const vehicle=ops.store.get('vehicle',id,actor.tenantId),assignment=ops.store.list('assignment',actor.tenantId).find(a=>a.vehicleId===id&&a.status==='active');
 ops.guard(actor,permission,{...vehicle,driverId:assignment?.driverId});return vehicle;
}
export function createMaintenanceExtensions(){return {
 'vehicle:serviceplan':(ops,actor,c)=>{
  fields(c.payload??{},['odometerMiles','intervalMiles','warningMiles','reason']);const p=c.payload,reason=text(p.reason,300),vehicle=vehicleFor(ops,actor,c.resourceId,'asset:manage');ops.version(vehicle,c.expectedVersion);
  requireValue(actor.role==='carrier','FORBIDDEN','The carrier owns service-interval configuration.',403);
  const odometerMiles=integer(p.odometerMiles,vehicle.odometerMiles??0,10000000),intervalMiles=integer(p.intervalMiles,1,1000000),warningMiles=integer(p.warningMiles,0,intervalMiles);
  return ops.change(actor,vehicle,{odometerMiles,serviceIntervalMiles:intervalMiles,serviceWarningMiles:warningMiles,nextServiceOdometer:odometerMiles+intervalMiles},c.action,reason);
 },
 'maintenance:record':(ops,actor,c)=>{
  fields(c.payload??{},['vehicleId','odometerMiles','performedAt','category','note']);const p=c.payload,vehicle=vehicleFor(ops,actor,p.vehicleId,'asset:service');
  requireValue(actor.role!=='carrier'||!vehicle.fleetId,'MAINTENANCE_OWNER','The fleet owns its maintenance records.',403);
  requireValue(['scheduled_service','inspection','repair','odometer_report'].includes(p.category),'CATEGORY','Choose a service category.');
  const performedAt=utc(p.performedAt);requireValue(performedAt<=ops.now().toISOString(),'SERVICE_DATE','Service information cannot be future-dated.');
  const odometerMiles=integer(p.odometerMiles,vehicle.odometerMiles??0,10000000);
  const row=ops.create(actor,'servicerecord',{vehicleId:vehicle.id,fleetId:vehicle.fleetId,driverId:actor.role==='driver'?actor.id:null,category:p.category,odometerMiles,performedAt,note:text(p.note,300),status:'pending_review',recordedBy:actor.id},c.action);
  // Odometer evidence may raise a warning; it never clears compliance or a carrier hold.
  ops.change(actor,vehicle,{odometerMiles},'vehicle:odometer');return row;
 },
 'maintenance:review':(ops,actor,c)=>{
  fields(c.payload??{},['decision','reason']);const p=c.payload,reason=text(p.reason,300),row=ops.read('servicerecord',c.resourceId,actor,'asset:manage');ops.version(row,c.expectedVersion);
  requireValue(['carrier','fleet'].includes(actor.role),'FORBIDDEN','Maintenance-owner review is required.',403);
  requireValue(actor.role!=='carrier'||!row.fleetId,'MAINTENANCE_OWNER','The fleet owns its maintenance review.',403);
  requireValue(row.status==='pending_review'&&['approve','reject'].includes(p.decision),'SERVICE_REVIEW','Review each pending service record once.',409);
  const vehicle=vehicleFor(ops,actor,row.vehicleId,'asset:manage');
  const result=ops.change(actor,row,{status:p.decision==='approve'?'approved':'rejected',reviewedBy:actor.id,reviewedAt:ops.now().toISOString()},c.action,reason);
  if(p.decision==='approve'&&row.category==='scheduled_service'&&vehicle.serviceIntervalMiles){
   const next=row.odometerMiles+vehicle.serviceIntervalMiles;requireValue(next>=(vehicle.nextServiceOdometer??0),'SERVICE_ORDER','An older service cannot move the due mileage backward.',409);
   ops.change(actor,vehicle,{nextServiceOdometer:next},'vehicle:serviceconfirmed',reason);
  }
  return result;
 }
};}
export function maintenanceState(ops,actor){
 const vehicles=ops.store.list('vehicle',actor.tenantId).filter(v=>{try{vehicleFor(ops,actor,v.id,'asset:view');return true;}catch{return false;}});
 const visible=new Set(vehicles.map(v=>v.id));
 return {serviceVehicles:vehicles.map(v=>({id:v.id,name:v.name,fleetId:v.fleetId,version:v.version,odometerMiles:v.odometerMiles??null,intervalMiles:v.serviceIntervalMiles??null,nextServiceOdometer:v.nextServiceOdometer??null,warningMiles:v.serviceWarningMiles??null,due:v.nextServiceOdometer!==undefined&&v.odometerMiles>=v.nextServiceOdometer-(v.serviceWarningMiles??0)})),
 serviceRecords:ops.store.list('servicerecord',actor.tenantId).filter(r=>visible.has(r.vehicleId)).map(r=>actor.role==='carrier'&&r.fleetId?{id:r.id,kind:r.kind,version:r.version,vehicleId:r.vehicleId,fleetId:r.fleetId,category:r.category,odometerMiles:r.odometerMiles,performedAt:r.performedAt,status:r.status}:{...r})};
}
