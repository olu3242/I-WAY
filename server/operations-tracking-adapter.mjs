import {authorize} from '../domain/authorization.mjs';
import {projectAsyncShipmentTracking} from '../domain/operations-async-tracking-projection.mjs';

// Bridge session identity to a PostgreSQL principal without trusting client-supplied scope.
// The PostgreSQL principal must independently match the authenticated session identity.
export function createGovernedTrackingProjection({store}={}){
 if(!store||typeof store.transaction!=='function')throw new TypeError('PostgreSQL store required');
 return async function governedTrackingProjection({scope,actor,shipmentId,limit=20,before=null}={}){
  if(!actor?.active||actor.id!==scope?.actorId||actor.tenantId!==scope?.tenantId){
   const e=new Error('Unauthorized');e.code='UNAUTHORIZED';throw e;
  }
  return projectAsyncShipmentTracking({
   store,scope,shipmentId,limit,before,
   authorizeTracking:async({principal,tx})=>{
    if(!principal?.active||principal.id!==actor.id||principal.tenantId!==actor.tenantId||principal.role!==actor.role)return false;
    if(!Array.isArray(principal.permissions)||!Array.isArray(actor.permissions))return false;
    if(!principal.permissions.includes('load:view')||!actor.permissions.includes('load:view'))return false;
    const shipment=await tx.get('shipment',shipmentId);
    const load=await tx.get('load',shipment.loadId);
    return authorize({actor:principal,action:'load:view',resource:load})&&authorize({actor,action:'load:view',resource:load});
   }
  });
 };
}
