// First bounded logistics command port to the asynchronous Operations contract.
// Caller authentication and scope must be established by a trusted server route.
import {executeAsyncOperationsCommand,AsyncCommandError} from './operations-async-command.mjs';
import {authorize as checkPermission} from './authorization.mjs';
const fields=value=>value&&typeof value==='object'&&!Array.isArray(value);
export async function createAsyncLoad({store,scope,command}={}){
 if(command?.action!=='load:create')throw new AsyncCommandError('UNSUPPORTED_COMMAND');
 return executeAsyncOperationsCommand({
  store,scope,command,
  authorize:async({principal})=>checkPermission({actor:principal,action:'load:manage',resource:{tenantId:scope.tenantId}}),
  perform:async({principal,command,tx})=>{
   const p=command.payload;
   if(!fields(p)||Object.keys(p).some(k=>!['reference','origin','destination','weightLb'].includes(k))||
      typeof p.reference!=='string'||!p.reference.trim()||p.reference.length>100||
      typeof p.origin!=='string'||!p.origin.trim()||p.origin.length>200||
      typeof p.destination!=='string'||!p.destination.trim()||p.destination.length>200||
      !Number.isSafeInteger(p.weightLb)||p.weightLb<=0)throw new AsyncCommandError('INVALID_LOAD');
   return tx.insert('load',{reference:p.reference.trim(),origin:p.origin.trim(),destination:p.destination.trim(),weightLb:p.weightLb,status:'draft',createdBy:principal.id});
  }
 });
}
