// Atomic reassignment of reserved shipment resources; not exposed to HTTP.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields} from './operations-errors.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export async function reassignAsyncShipment({store,scope,command,authorizeReassignment}={}){
 if(command?.action!=='shipment:reassign')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeReassignment!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeReassignment({principal,tx,scope,action:'shipment:reassign',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,['driverId','vehicleId']);
   const {driverId,vehicleId}=command.payload;
   if(!uuid(command.resourceId)||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1||!uuid(driverId)||!uuid(vehicleId))throw new AsyncCommandError('INVALID_COMMAND');
   const shipment=await tx.get('shipment',command.resourceId),load=await tx.get('load',shipment.loadId);
   if(shipment.tenantId!==scope.tenantId||load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   if(!['draft','dispatched'].includes(shipment.status)||shipment.status!==load.status)throw new AsyncCommandError('INVALID_TRANSITION');
   if(shipment.version!==command.expectedVersion)throw new AsyncCommandError('STALE');
   if(!shipment.driverId||!shipment.vehicleId||shipment.driverId!==load.driverId||shipment.vehicleId!==load.vehicleId)throw new AsyncCommandError('ASSIGNMENT_INTEGRITY');
   if(driverId===shipment.driverId&&vehicleId===shipment.vehicleId)throw new AsyncCommandError('UNCHANGED_ASSIGNMENT');
   const oldDriver=await tx.get('driver',shipment.driverId),oldVehicle=await tx.get('vehicle',shipment.vehicleId);
   if(oldDriver.available!==false||oldVehicle.available!==false)throw new AsyncCommandError('ASSIGNMENT_INTEGRITY');
   if(driverId!==oldDriver.id){
    const replacement=await tx.get('driver',driverId);
    if(replacement.tenantId!==scope.tenantId||replacement.active!==true||replacement.available!==true)throw new AsyncCommandError('RESOURCE_UNAVAILABLE');
    await tx.update('driver',replacement.id,replacement.version,{available:false});
    await tx.update('driver',oldDriver.id,oldDriver.version,{available:true});
   }
   if(vehicleId!==oldVehicle.id){
    const replacement=await tx.get('vehicle',vehicleId);
    if(replacement.tenantId!==scope.tenantId||replacement.active!==true||replacement.available!==true)throw new AsyncCommandError('RESOURCE_UNAVAILABLE');
    await tx.update('vehicle',replacement.id,replacement.version,{available:false});
    await tx.update('vehicle',oldVehicle.id,oldVehicle.version,{available:true});
   }
   await tx.update('load',load.id,load.version,{driverId,vehicleId});
   return tx.update('shipment',shipment.id,command.expectedVersion,{driverId,vehicleId});
  }
 });
}
