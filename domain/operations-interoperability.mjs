import {fields,text,requireValue,utc} from './operations-errors.mjs';
export const logisticsEventTypes=Object.freeze(['shipment','driver','vehicle','milestone','document','delivery']);
const identifier=value=>{const result=text(value,100);requireValue(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(result),'EVENT_IDENTIFIER','Use a bounded event or evidence identifier.');return result;};
export function normalizeLogisticsEvent(ops,actor,load,event){
 fields(event,['schemaVersion','externalId','type','occurredAt','data']);
 ops.guard(actor,'connector:request',load);ops.guard(actor,'load:view',load);
 requireValue(event.schemaVersion===1&&logisticsEventTypes.includes(event.type),'EVENT_SCHEMA','Use a supported version 1 logistics event.');
 const externalId=identifier(event.externalId),occurredAt=utc(event.occurredAt);
 requireValue(occurredAt<=ops.now().toISOString(),'EVENT_TIME','Reported events cannot be future-dated.');
 const p=event.data;let data;
 if(event.type==='shipment'){
  fields(p,['status']);requireValue(['queued','in_transit','delivered','delayed','cancelled'].includes(p.status),'EVENT_STATUS','Unsupported reported shipment status.');data={status:p.status};
 }else if(event.type==='driver'){
  fields(p,['driverId','available']);requireValue(typeof p.available==='boolean'&&p.driverId===load.driverId&&!!load.driverId,'EVENT_RELATIONSHIP','Driver evidence must match this shipment assignment.');
  const driver=ops.read('driver',p.driverId,actor);data={driverId:driver.id,available:p.available};
 }else if(event.type==='vehicle'){
  fields(p,['vehicleId','maintenance']);requireValue(p.vehicleId===load.vehicleId&&!!load.vehicleId&&['ready','due','out_of_service'].includes(p.maintenance),'EVENT_RELATIONSHIP','Vehicle evidence must match this shipment assignment.');
  const vehicle=ops.read('vehicle',p.vehicleId,actor);data={vehicleId:vehicle.id,maintenance:p.maintenance};
 }else if(event.type==='milestone'){
  fields(p,['stopId','milestone']);requireValue(load.stops.some(stop=>stop.id===p.stopId)&&['arrived','departed'].includes(p.milestone),'EVENT_STOP','Choose a shipment stop and supported milestone.');data={stopId:p.stopId,milestone:p.milestone};
 }else if(event.type==='document'){
  fields(p,['documentId','contentHash','status']);const document=ops.read('document',identifier(p.documentId),actor);ops.guard(actor,'document:view',load);
  requireValue(document.loadId===load.id&&document.contentHash===p.contentHash&&['received','review_requested'].includes(p.status),'EVENT_DOCUMENT','Document evidence must identify an existing document on this shipment.');
  data={documentId:document.id,contentHash:document.contentHash,status:p.status};
 }else{
  fields(p,['stopId','recipientAcknowledged','evidenceReference']);requireValue(load.stops.some(stop=>stop.id===p.stopId&&stop.type==='delivery')&&p.recipientAcknowledged===true,'EVENT_DELIVERY','Delivery evidence requires the shipment delivery stop and reported acknowledgment.');
  data={stopId:p.stopId,recipientAcknowledged:true,evidenceReference:identifier(p.evidenceReference)};
 }
 return {schemaVersion:1,externalId,type:event.type,occurredAt,loadId:load.id,data,verification:'provider_reported_unverified',applied:false,requiresHumanReview:true};
}
