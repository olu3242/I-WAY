// Read-only, tenant-scoped tracking projection; bounded to 500 tenant events until indexed queries ship.
import {AsyncCommandError} from './operations-async-command.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function projectAsyncShipmentTracking({store,scope,shipmentId,authorizeTracking}={}){
 if(!store||typeof store.transaction!=='function'||!scope||!uuid(shipmentId))throw new AsyncCommandError('INVALID_CONTEXT');
 if(typeof authorizeTracking!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return store.transaction(scope,async tx=>{
  const principal=await tx.principal();
  if(!principal?.active||principal.id!==scope.actorId||principal.tenantId!==scope.tenantId)throw new AsyncCommandError('UNAUTHORIZED');
  if(await authorizeTracking({principal,tx,scope,action:'tracking:read',resourceId:shipmentId})!==true)throw new AsyncCommandError('FORBIDDEN');
  const shipment=await tx.get('shipment',shipmentId);
  const load=await tx.get('load',shipment.loadId);
  if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
  const history=(await tx.list('tracking',{limit:500})).filter(event=>event.shipmentId===shipmentId).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.id.localeCompare(b.id));
  const latestEvent=history.at(-1)??null;
  return {shipmentId,loadId:load.id,status:shipment.status,latestLocation:latestEvent?.location??null,latestEvent,history};
 });
}
