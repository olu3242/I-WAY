// Read-only, tenant-scoped tracking projection; uses shipment-scoped cursor pagination.
import {AsyncCommandError} from './operations-async-command.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function projectAsyncShipmentTracking({store,scope,shipmentId,authorizeTracking,limit=100,before=null}={}){
 if(!store||typeof store.transaction!=='function'||!scope||!uuid(shipmentId))throw new AsyncCommandError('INVALID_CONTEXT');
 if(!Number.isInteger(limit)||limit<1||limit>200||before!==null&&(!before||typeof before!=='object'||typeof before.occurredAt!=='string'||!Number.isFinite(Date.parse(before.occurredAt))||!uuid(before.id)||before.shipmentId!==shipmentId))throw new AsyncCommandError('INVALID_PAGE');
 if(typeof authorizeTracking!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return store.transaction(scope,async tx=>{
  const principal=await tx.principal();
  if(!principal?.active||principal.id!==scope.actorId||principal.tenantId!==scope.tenantId)throw new AsyncCommandError('UNAUTHORIZED');
  if(await authorizeTracking({principal,tx,scope,action:'tracking:read',resourceId:shipmentId})!==true)throw new AsyncCommandError('FORBIDDEN');
  const shipment=await tx.get('shipment',shipmentId);
  const load=await tx.get('load',shipment.loadId);
  if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
  const latestEvent=(await tx.trackingHistory(shipmentId,{limit:1}))[0]??null;
  const fetched=await tx.trackingHistory(shipmentId,{limit:limit+1,before});
  const page=fetched.slice(0,limit),tail=page.at(-1),hasMore=fetched.length>limit;
  return {shipmentId,loadId:load.id,status:shipment.status,latestLocation:latestEvent?.location??null,latestEvent,history:page.slice().reverse(),nextCursor:hasMore?{shipmentId,occurredAt:tail.occurredAt,id:tail.id}:null,hasMore};
 });
}
