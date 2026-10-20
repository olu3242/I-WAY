import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createIsolatedOnboardingHttpServer} from '../server/operations-onboarding-http.experimental.mjs';
const request={invitationId:'invite',tenantId:'tenant',actorId:'actor',role:'driver',token:'fixture-token',expectedNonce:'fixture-nonce'};
test('HTTP boundary passes only explicit fields and returns minimal result',async()=>{
 let received;
 const server=createIsolatedOnboardingHttpServer({resolveInvitationContext:async({invitationId})=>({invitationId,tenantId:'trusted-tenant',actorId:'trusted-actor',role:'driver',expectedNonce:'trusted-nonce'}),verifiedProvisioning:{async provision(input){received=input;return {state:'ACTIVE',invitationId:input.invitationId,accountId:'secret-account'}}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/experimental/onboarding/provision',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...request,verifiedIssuer:'spoofed',subjectHash:'spoofed'})});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{state:'ACTIVE',invitationId:'invite'});
  assert.equal('verifiedIssuer' in received,false);
  assert.equal('subjectHash' in received,false);
  assert.equal(received.tenantId,'trusted-tenant');
  assert.equal(received.actorId,'trusted-actor');
  assert.equal(received.expectedNonce,'trusted-nonce');
 }finally{server.close();}
});
test('HTTP boundary fails closed without verified provisioning',async()=>{
 const server=createIsolatedOnboardingHttpServer({resolveInvitationContext:async({invitationId})=>({invitationId,tenantId:'trusted-tenant',actorId:'trusted-actor',role:'driver',expectedNonce:'trusted-nonce'}),verifiedProvisioning:{async provision(){throw Error('UNVERIFIED')}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/experimental/onboarding/provision',{method:'POST',body:JSON.stringify(request)});
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:'PROVISIONING_DENIED'});
 }finally{server.close();}
});

test('HTTP boundary rejects absent trusted invitation context',async()=>{
 let called=false;
 const server=createIsolatedOnboardingHttpServer({resolveInvitationContext:async()=>null,verifiedProvisioning:{async provision(){called=true;}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/experimental/onboarding/provision',{method:'POST',body:JSON.stringify(request)});
  assert.equal(response.status,403);assert.equal(called,false);
 }finally{server.close();}
});
