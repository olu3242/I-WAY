import {validateOfflineCommand} from '../domain/driver-offline-replay.mjs';
import {principalFingerprint} from './operations-identity.mjs';
import {requireValue} from '../domain/operations-errors.mjs';
export function offlineContext(actor){
 requireValue(actor?.active&&actor.role==='driver'&&actor.permissions.includes('load:execute'),'FORBIDDEN','Driver execution authority required.',403);
 return {actorId:actor.id,tenantId:actor.tenantId,authorityFingerprint:principalFingerprint(actor)};
}
export function executeOfflineCommand(operations,actor,envelope){
 const context=offlineContext(operations.actor(actor.id));let entry;
 try{entry=validateOfflineCommand(envelope,context,operations.now().getTime());}catch{requireValue(false,'OFFLINE_INVALID','The queued action expired or its authority changed. Cancel it and review the current assignment.',409);}
 // Live authorization precedes even an idempotent receipt lookup.
 const load=operations.read('load',entry.resourceId,actor,'load:execute');
 requireValue(load.driverId===actor.id,'FORBIDDEN','This assignment is no longer yours.',403);
 const eligibility=operations.eligibility(actor,load.driverId,load.vehicleId,load,load.id);
 requireValue(eligibility.eligible,'INELIGIBLE','Current assignment eligibility must be reviewed.',409);
 const result=operations.execute(actor.id,{action:entry.action,resourceId:entry.resourceId,expectedVersion:entry.expectedVersion,idempotencyKey:entry.idempotencyKey,payload:{...entry.payload}});
 return {confirmed:true,idempotencyKey:entry.idempotencyKey,result};
}
