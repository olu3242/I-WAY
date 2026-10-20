// Bounded append-only tracking event command; not exposed to HTTP until authorization parity.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields,text,utc} from './operations-errors.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function recordAsyncTrackingEvent({store,scope,command,authorizeTracking}={}){
 if(command?.action!=='tracking:record')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeTracking!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeTracking({principal,tx,scope,action:'tracking:record',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,['eventType','occurredAt','location']);
   if(!uuid(command.resourceId)||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1)throw new AsyncCommandError('INVALID_COMMAND');
   const eventType=text(command.payload.eventType,40);
   if(!['arrived','departed','in_transit','delivered','exception'].includes(eventType))throw new AsyncCommandError('INVALID_EVENT_TYPE');
   const occurredAt=utc(command.payload.occurredAt),location=text(command.payload.location,160);
   const shipment=await tx.get('shipment',command.resourceId);
   const load=await tx.get('load',shipment.loadId);
   if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(shipment.version!==command.expectedVersion)throw new AsyncCommandError('STALE');
   if(shipment.status!=='dispatched'||load.status!=='dispatched')throw new AsyncCommandError('INVALID_TRANSITION');
   return tx.insert('tracking',{shipmentId:shipment.id,loadId:load.id,eventType,occurredAt,location,recordedBy:scope.actorId});
  }
 });
}
