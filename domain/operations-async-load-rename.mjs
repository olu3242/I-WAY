// Narrow PostgreSQL migration slice: rename a load under trusted server authorization.
// Not exposed over HTTP until session/permission parity is certified.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {fields,text} from './operations-errors.mjs';
export async function renameAsyncLoad({store,scope,command,authorizeLoad}={}){
 if(command?.action!=='load:rename')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 if(typeof authorizeLoad!=='function')throw new AsyncCommandError('AUTHORIZATION_NOT_CONFIGURED');
 return executeAsyncOperationsCommand({store,scope,command,
  authorize:async({principal,tx})=>authorizeLoad({principal,tx,scope,action:'load:rename',resourceId:command.resourceId}),
  perform:async({tx})=>{
   fields(command.payload,['reference']);
   const reference=text(command.payload.reference,40);
   if(typeof command.resourceId!=='string'||!Number.isInteger(command.expectedVersion)||command.expectedVersion<1)throw new AsyncCommandError('INVALID_COMMAND');
   const existing=await tx.get('load',command.resourceId);
   if(existing.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
   return tx.update('load',command.resourceId,command.expectedVersion,{reference});
  }
 });
}
