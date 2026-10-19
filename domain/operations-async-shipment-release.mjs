// Atomic release of reserved shipment resources; no production route pending parity.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields} from './operations-errors.mjs';
export async function releaseAsyncShipment({store,scope,command,authorizeRelease}={}){
 if(command?.action!=='shipment:release')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeRelease!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeRelease({principal,tx,scope,action:'shipment:release',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,[]);
   if(typeof command.resourceId!=='string'||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1)throw new AsyncCommandError('INVALID_COMMAND');
   const shipment=await tx.get('shipment',command.resourceId);
   const load=await tx.get('load',shipment.loadId);
   if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(!['draft','dispatched'].includes(shipment.status)||shipment.status!==load.status)throw new AsyncCommandError('INVALID_TRANSITION');
   if(shipment.version!==command.expectedVersion)throw new AsyncCommandError('STALE');
   if(!shipment.driverId||!shipment.vehicleId||shipment.driverId!==load.driverId||shipment.vehicleId!==load.vehicleId)throw new AsyncCommandError('ASSIGNMENT_INTEGRITY');
   const driver=await tx.get('driver',shipment.driverId),vehicle=await tx.get('vehicle',shipment.vehicleId);
   if(driver.tenantId!==scope.tenantId||vehicle.tenantId!==scope.tenantId||driver.available!==false||vehicle.available!==false)throw new AsyncCommandError('ASSIGNMENT_INTEGRITY');
   await tx.update('driver',driver.id,driver.version,{available:true});
   await tx.update('vehicle',vehicle.id,vehicle.version,{available:true});
   await tx.update('load',load.id,load.version,{driverId:null,vehicleId:null});
   return tx.update('shipment',shipment.id,command.expectedVersion,{driverId:null,vehicleId:null});
  }
 });
}
