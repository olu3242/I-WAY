/** Tenant-scoped organization configuration service.
 * Storage is injected; caller must supply an authenticated, current actor.
 * Persistence adapter must enforce transaction-local tenant context and RLS.
 */
import {validateOrganizationSettings} from './enterprise-admin.mjs';
const KEYS=Object.freeze(['legalName','displayName','timeZone','currency','dotNumber']);
export function authorizeOrganizationSettings(actor,tenantId,operation){
 return !!actor?.id&&actor.active!==false&&typeof tenantId==='string'&&tenantId.length>0&&actor.tenantId===tenantId&&actor.role==='carrier'&&Array.isArray(actor.permissions)&&actor.permissions.includes('governance:manage')&&['read','write'].includes(operation);
}
export function sanitizeOrganizationSettings(settings){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return null;
 return Object.fromEntries(KEYS.filter(k=>Object.hasOwn(settings,k)).map(k=>[k,settings[k]]));
}
export function createOrganizationSettingsService(store){
 if(!store||typeof store.read!=='function'||typeof store.write!=='function')throw new TypeError('tenant-bound storage adapter required');
 return Object.freeze({
  async read({actor,tenantId}){
   if(!authorizeOrganizationSettings(actor,tenantId,'read'))return {ok:false,code:'FORBIDDEN'};
   const result=await store.read({actor,tenantId});
   if(!result||result.tenantId!==tenantId)return {ok:false,code:'NOT_FOUND'};
   return {ok:true,settings:sanitizeOrganizationSettings(result.settings),version:result.version};
  },
  async update({actor,tenantId,settings,expectedVersion}){
   if(!authorizeOrganizationSettings(actor,tenantId,'write'))return {ok:false,code:'FORBIDDEN'};
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)return {ok:false,code:'INVALID_VERSION'};
   if(!settings||Object.keys(settings).some(k=>!KEYS.includes(k)))return {ok:false,code:'INVALID_SETTINGS'};
   const normalized=sanitizeOrganizationSettings(settings);
   const check=validateOrganizationSettings(normalized);
   if(!check.valid)return {ok:false,code:'VALIDATION_FAILED',errors:check.errors};
   const result=await store.write({actor,tenantId,settings:normalized,expectedVersion});
   if(!result||result.tenantId!==tenantId)return {ok:false,code:'CONFLICT'};
   return {ok:true,settings:sanitizeOrganizationSettings(result.settings),version:result.version};
  }
 });
}
