// Bounded assignment port: atomic load/shipment driver and vehicle allocation.
// Not routed to production until identity, fleet and workflow parity are certified.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields} from './operations-errors.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export async function assignAsyncShipment({store,scope,command,authorizeAssignment}={}){
 if(command?.action!=='shipment:assign')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeAssignment!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeAssignment({principal,tx,scope,action:'shipment:assign',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,['driverId','vehicleId']);
   const {driverId,vehicleId}=command.payload;
   if(!uuid(command.resourceId)||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1||!uuid(driverId)||!uuid(vehicleId))throw new AsyncCommandError('INVALID_COMMAND');
   const shipment=await tx.get('shipment',command.resourceId);
   const load=await tx.get('load',shipment.loadId);
   if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(!['draft','dispatched'].includes(shipment.status)||!['draft','dispatched'].includes(load.status)||shipment.status!==load.status)throw new AsyncCommandError('INVALID_TRANSITION');
   if(shipment.driverId||shipment.vehicleId||load.driverId||load.vehicleId)throw new AsyncCommandError('ALREADY_ASSIGNED');
   if(shipment.version!==command.expectedVersion)throw new AsyncCommandError('STALE');
   const driver=await tx.get('driver',driverId),vehicle=await tx.get('vehicle',vehicleId);
   if(driver.tenantId!==scope.tenantId||vehicle.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(driver.active!==true||vehicle.active!==true||driver.available!==true||vehicle.available!==true)throw new AsyncCommandError('RESOURCE_UNAVAILABLE');
   await tx.update('driver',driver.id,driver.version,{available:false});
   await tx.update('vehicle',vehicle.id,vehicle.version,{available:false});
   await tx.update('load',load.id,load.version,{driverId,vehicleId});
   return tx.update('shipment',shipment.id,command.expectedVersion,{driverId,vehicleId});
  }
 });
}
