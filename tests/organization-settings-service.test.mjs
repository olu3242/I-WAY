import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrganizationSettingsService,authorizeOrganizationSettings} from '../domain/organization-settings-service.mjs';
const actor={id:'owner',tenantId:'a',role:'carrier',permissions:['governance:manage']};
const settings={legalName:'A Logistics',timeZone:'America/Chicago',currency:'USD'};
function fixture(){
 const rows=new Map();
 return createOrganizationSettingsService({
  async read({tenantId}){return rows.get(tenantId)||null},
  async write({tenantId,settings,expectedVersion}){
   const prior=rows.get(tenantId);
   if((prior?.version??0)!==expectedVersion)return null;
   const next={tenantId,settings,version:expectedVersion+1};rows.set(tenantId,next);return next;
  }
 });
}
test('company settings require current same-tenant governance authority',async()=>{
 const svc=fixture();
 assert.equal(authorizeOrganizationSettings(actor,'b','write'),false);
 assert.deepEqual(await svc.update({actor,tenantId:'b',settings,expectedVersion:0}),{ok:false,code:'FORBIDDEN'});
 assert.equal((await svc.update({actor:{...actor,active:false},tenantId:'a',settings,expectedVersion:0})).code,'FORBIDDEN');
 assert.equal((await svc.update({actor:{...actor,role:'dispatcher'},tenantId:'a',settings,expectedVersion:0})).code,'FORBIDDEN');
});
test('settings writes are validated, versioned, and scoped',async()=>{
 const svc=fixture();
 assert.equal((await svc.update({actor,tenantId:'a',settings:{...settings,secret:'no'},expectedVersion:0})).code,'INVALID_SETTINGS');
 assert.equal((await svc.update({actor,tenantId:'a',settings:{legalName:''},expectedVersion:0})).code,'VALIDATION_FAILED');
 assert.deepEqual(await svc.update({actor,tenantId:'a',settings,expectedVersion:0}),{ok:true,settings,version:1});
 assert.equal((await svc.update({actor,tenantId:'a',settings,expectedVersion:0})).code,'CONFLICT');
 assert.deepEqual(await svc.read({actor,tenantId:'a'}),{ok:true,settings,version:1});
 assert.equal((await svc.read({actor,tenantId:'b'})).code,'FORBIDDEN');
});
