// Bounded atomic load/shipment dispatch port; not exposed to HTTP pending parity.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields} from './operations-errors.mjs';
export async function dispatchAsyncShipment({store,scope,command,authorizeDispatch}={}){
 if(command?.action!=='shipment:dispatch')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeDispatch!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeDispatch({principal,tx,scope,action:'shipment:dispatch',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,[]);
   if(typeof command.resourceId!=='string'||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1)throw new AsyncCommandError('INVALID_COMMAND');
   const shipment=await tx.get('shipment',command.resourceId);
   const load=await tx.get('load',shipment.loadId);
   if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(shipment.status!=='draft'||load.status!=='draft')throw new AsyncCommandError('INVALID_TRANSITION');
   if(shipment.version!==command.expectedVersion)throw new AsyncCommandError('STALE');
   const updatedLoad=await tx.update('load',load.id,load.version,{status:'dispatched'});
   const updatedShipment=await tx.update('shipment',shipment.id,command.expectedVersion,{status:'dispatched'});
   if(updatedLoad.status!=='dispatched'||updatedShipment.status!=='dispatched')throw new AsyncCommandError('DISPATCH_INTEGRITY');
   return updatedShipment;
  }
 });
}
