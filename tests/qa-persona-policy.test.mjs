import test from 'node:test';
import assert from 'node:assert/strict';
import {canStartQaPersona,resolveQaPersona} from '../domain/qa-persona-policy.mjs';
const actor={id:'platform-1',active:true,role:'platform_admin',qaPersonaSwitch:true};
const target={id:'driver-1',active:true,role:'driver',tenantId:'tenant-a'};
const base={actorId:actor.id,targetId:target.id,tenantId:target.tenantId,role:target.role,id:'session-1',reason:'QA journey verification',issuedAt:1000,expiresAt:901000};
const context={actor,target,enabled:true,environment:'staging',now:2000};
test('authorized QA switch resolves bounded actor context',()=>{
 assert.deepEqual(resolveQaPersona({...context,session:base}),{originalActorId:'platform-1',effectiveActorId:'driver-1',tenantId:'tenant-a',role:'driver',sessionId:'session-1'});
});
test('denies production and disabled flag',()=>{
 assert.equal(canStartQaPersona({...context,reason:base.reason,environment:'production'}),false);
 assert.equal(canStartQaPersona({...context,reason:base.reason,enabled:false}),false);
});
test('denies non-platform and inactive actors',()=>{
 assert.equal(canStartQaPersona({...context,actor:{...actor,role:'carrier'},reason:base.reason}),false);
 assert.equal(canStartQaPersona({...context,actor:{...actor,active:false},reason:base.reason}),false);
});
test('denies session forgery, expiry, revocation and tenant changes',()=>{
 for(const patch of [{actorId:'other'},{targetId:'other'},{tenantId:'tenant-b'},{role:'carrier'},{revoked:true},{expiresAt:2000},{expiresAt:1000000}]){
  assert.equal(resolveQaPersona({...context,session:{...base,...patch}}),null);
 }
});
test('denies unapproved target roles and missing reason',()=>{
 assert.equal(canStartQaPersona({...context,target:{...target,role:'platform_admin'},reason:base.reason}),false);
 assert.equal(canStartQaPersona({...context,reason:'short'}),false);
});
