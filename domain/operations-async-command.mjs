// Asynchronous transaction boundary for gradual PostgreSQL Operations migration.
// A caller must supply a trusted, authenticated tenant/principal scope and an
// authorized command handler. This does not replace Operations.execute().
import {createHash} from 'node:crypto';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const keyOK=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export class AsyncCommandError extends Error{
 constructor(code){super('Asynchronous command rejected');this.name='AsyncCommandError';this.code=code;}
}
export async function executeAsyncOperationsCommand({store,scope,command,authorize,perform}={}){
 if(!store||typeof store.transaction!=='function'||!scope||!uuid(scope.tenantId)||!uuid(scope.actorId)||!command||typeof command!=='object'||Array.isArray(command)||typeof authorize!=='function'||typeof perform!=='function')throw new AsyncCommandError('INVALID_CONTEXT');
 if(Object.keys(command).some(k=>!['action','resourceId','expectedVersion','idempotencyKey','payload'].includes(k))||typeof command.action!=='string'||!/^[a-z]+:[a-z]+$/.test(command.action)||!keyOK(command.idempotencyKey))throw new AsyncCommandError('INVALID_COMMAND');
 const digest=hash(command);
 return store.transaction(scope,async tx=>{
  const principal=await tx.principal();
  if(!principal?.active||principal.id!==scope.actorId||principal.tenantId!==scope.tenantId)throw new AsyncCommandError('UNAUTHORIZED');
  // Check authorization even for idempotent replay: revoked actors cannot replay.
  if(await authorize({principal,command,tx})!==true)throw new AsyncCommandError('FORBIDDEN');
  const previous=await tx.command(command.idempotencyKey);
  if(previous){
   if(previous.digest!==digest)throw new AsyncCommandError('IDEMPOTENCY_CONFLICT');
   if(!previous.result||typeof previous.result!=='object'||Array.isArray(previous.result)||
      (Object.hasOwn(previous.result,'tenantId')&&previous.result.tenantId!==scope.tenantId))throw new AsyncCommandError('REPLAY_RESULT_INVALID');
   return previous.result;
  }
  const result=await perform({principal,command,tx});
  if(!result||typeof result!=='object'||Array.isArray(result))throw new AsyncCommandError('INVALID_RESULT');
  // Never persist a result whose claimed ownership disagrees with the trusted
  // transaction scope. Replay must not become a cross-tenant read channel.
  if(Object.hasOwn(result,'tenantId')&&result.tenantId!==scope.tenantId)throw new AsyncCommandError('RESULT_TENANT_MISMATCH');
  await tx.recordCommand(command.idempotencyKey,digest,result);
  await tx.audit({action:command.action,resourceId:null,outcome:'success',detail:{}});
  return result;
 });
}
