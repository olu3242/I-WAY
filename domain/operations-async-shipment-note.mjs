// Bounded shipment note command; not exposed to HTTP before authorization parity.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields,text} from './operations-errors.mjs';
export async function noteAsyncShipment({store,scope,command,authorizeShipment}={}){
 if(command?.action!=='shipment:note')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeShipment!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeShipment({principal,tx,scope,action:'shipment:note',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,['note']);
   const note=text(command.payload.note,500);
   if(typeof command.resourceId!=='string'||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1)throw new AsyncCommandError('INVALID_COMMAND');
   const existing=await tx.get('shipment',command.resourceId);
   if(existing.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   const parent=await tx.get('load',existing.loadId);
   if(parent.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   return tx.update('shipment',command.resourceId,command.expectedVersion,{note});
  }
 });
}
