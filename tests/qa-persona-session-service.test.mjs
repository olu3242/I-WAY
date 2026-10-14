import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaPersonaSessionService} from '../domain/qa-persona-session-service.mjs';
const actor={id:'11111111-1111-4111-8111-111111111111',verified:true,active:true,role:'platform_admin',qaPersonaSwitchAllowed:true};
const target={id:'22222222-2222-4222-8222-222222222222',tenantId:'33333333-3333-4333-8333-333333333333',active:true,qaAccount:true,role:'driver'};
function fixture(){let time=1000;const grants=new Map(),events=[];const service=createQaPersonaSessionService({
 lookupActor:async id=>id===actor.id?actor:null,lookupTarget:async id=>id===target.id?target:null,
 saveGrant:async grant=>{grants.set(grant.id,grant)},loadGrant:async id=>grants.get(id),
 revokeGrant:async id=>{grants.get(id).revoked=true},appendAudit:async event=>{events.push(event)},
 environment:'test',enabled:true,now:()=>time
});return {service,grants,events,advance:ms=>time+=ms}}
test('start, resolve, revoke and audit session',async()=>{
 const f=fixture(),started=await f.service.start({authenticatedActorId:actor.id,targetId:target.id});
 assert.ok(started?.grantId);const ctx=await f.service.resolve({authenticatedActorId:actor.id,grantId:started.grantId});
 assert.equal(ctx.realActorId,actor.id);assert.equal(ctx.effectiveActorId,target.id);
 assert.equal(await f.service.stop({authenticatedActorId:actor.id,grantId:started.grantId}),true);
 assert.equal(await f.service.resolve({authenticatedActorId:actor.id,grantId:started.grantId}),null);
 assert.deepEqual(f.events.map(x=>x.action),['qa:switch:start','qa:switch:stop']);
});
test('cannot resolve another actor session',async()=>{
 const f=fixture(),g=await f.service.start({authenticatedActorId:actor.id,targetId:target.id});
 assert.equal(await f.service.resolve({authenticatedActorId:target.id,grantId:g.grantId}),null);
 assert.equal(await f.service.stop({authenticatedActorId:target.id,grantId:g.grantId}),false);
});
test('expiry denies access',async()=>{
 const f=fixture(),g=await f.service.start({authenticatedActorId:actor.id,targetId:target.id});
 f.advance(15*60*1000);
 assert.equal(await f.service.resolve({authenticatedActorId:actor.id,grantId:g.grantId}),null);
});
test('unauthorized initiation audited',async()=>{
 const f=fixture();
 assert.equal(await f.service.start({authenticatedActorId:target.id,targetId:actor.id}),null);
 assert.equal(f.events[0].action,'qa:switch:denied');
});
