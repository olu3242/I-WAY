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

test('B407 challenge endpoint requires bearer session and returns minimal nonce',async()=>{
 let issued=0;
 const server=createIsolatedOnboardingHttpServer({
  resolveInvitationContext:async()=>null,
  verifiedProvisioning:{async provision(){throw Error('unexpected');}},
  challengeCustody:{async issue({sessionToken,invitationId}){issued++;if(sessionToken!=='valid'||invitationId!=='invite')throw Error('DENIED');return {nonce:'fixture-issued-nonce'};}}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const url='http://127.0.0.1:'+server.address().port+'/experimental/onboarding/challenge';
  const post=(authorization)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify({invitationId:'invite'})});
  assert.equal((await post()).status,403);
  assert.equal(issued,0);
  assert.equal((await post('Bearer invalid')).status,403);
  const response=await post('Bearer valid');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{nonce:'fixture-issued-nonce'});
 }finally{server.close();}
});
