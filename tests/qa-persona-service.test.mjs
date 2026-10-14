import test from 'node:test';
import assert from 'node:assert/strict';
import {createQaPersonaService} from '../domain/qa-persona-service.mjs';
const actor={id:'admin',role:'platform_admin',active:true,qaPersonaSwitch:true};
const target={id:'driver',role:'driver',active:true,tenantId:'tenant-a'};
function fixture(){
 const sessions=new Map(),audits=[];
 const service=createQaPersonaService({
  resolveActor:async subject=>subject==='verified-admin'?actor:null,
  resolveTarget:async id=>id==='driver'?target:null,
  saveSession:async session=>{sessions.set(session.id,session)},
  readSession:async id=>sessions.get(id),
  revokeSession:async id=>{sessions.set(id,{...sessions.get(id),revoked:true})},
  appendAudit:async event=>{audits.push(event)},
  enabled:true,environment:'staging',clock:()=>10000
 });
 return {service,sessions,audits};
}
test('issues audited bounded session and revokes it',async()=>{
 const {service,audits}=fixture();
 const started=await service.start({authenticatedSubjectId:'verified-admin',targetId:'driver',reason:'Validate driver journey'});
 const context=await service.resolve({authenticatedSubjectId:'verified-admin',sessionId:started.sessionId});
 assert.equal(context.effectiveActorId,'driver');
 assert.equal(context.originalActorId,'admin');
 assert.equal(audits[0].event,'qa_persona_started');
 assert.deepEqual(await service.stop({authenticatedSubjectId:'verified-admin',sessionId:started.sessionId}),{revoked:true});
 assert.equal(await service.resolve({authenticatedSubjectId:'verified-admin',sessionId:started.sessionId}),null);
 assert.equal(audits[1].event,'qa_persona_stopped');
});
test('rejects unauthenticated actor and forged session access',async()=>{
 const {service}=fixture();
 await assert.rejects(service.start({authenticatedSubjectId:'unknown',targetId:'driver',reason:'Validate driver journey'}),/QA_PERSONA_DENIED/);
 const started=await service.start({authenticatedSubjectId:'verified-admin',targetId:'driver',reason:'Validate driver journey'});
 assert.equal(await service.resolve({authenticatedSubjectId:'unknown',sessionId:started.sessionId}),null);
});
