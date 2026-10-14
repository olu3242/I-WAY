// Bounded asynchronous load-create port. Not routed to production until
// identity lookup, PostgreSQL grants and parity tests are certified.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {normalizeLoadCreatePayload} from './operations-load-contract.mjs';
export async function createAsyncLoad({store,scope,command,authorizeLoad,now=()=>new Date()}={}){
 if(command?.action!=='load:create')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeLoad!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeLoad({principal,tx,scope,action:'load:create'}),
  perform:async({principal,tx})=>{
   if(typeof tx.user!=='function'||typeof tx.get!=='function'||typeof tx.insert!=='function')throw new AsyncCommandError('STORE_PARITY_INCOMPLETE');
   const normalized=normalizeLoadCreatePayload(command.payload);
   const dispatcher=await tx.user(normalized.dispatcherId);
   if(!dispatcher||dispatcher.tenantId!==scope.tenantId||dispatcher.role!=='dispatcher'||dispatcher.active!==true)throw new AsyncCommandError('INVALID_DISPATCHER');
   if(normalized.customerId){
    const customer=await tx.get('customer',normalized.customerId);
    if(customer.tenantId!==scope.tenantId||customer.active!==true)throw new AsyncCommandError('INVALID_CUSTOMER');
   }
   const createdAt=now().toISOString();
   const load=await tx.insert('load',{...normalized,dispatcherId:dispatcher.id,status:'draft',driverId:null,vehicleId:null,fleetId:null,createdAt});
   if(load.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   const shipment=await tx.insert('shipment',{loadId:load.id,dispatcherId:dispatcher.id,driverId:null,fleetId:null,commodity:load.commodity,weightLb:load.weightLb,stops:load.stops,status:'draft'});
   if(shipment.tenantId!==scope.tenantId||shipment.loadId!==load.id)throw new AsyncCommandError('SHIPMENT_INTEGRITY');
   return load;
  }
 });
}
