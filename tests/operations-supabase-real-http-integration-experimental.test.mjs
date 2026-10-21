import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';

test('B476 real HTTP requests enforce tenant role, cookie and safe responses',async()=>{
 const sid='s'.repeat(43);
 let protectedCalls=0;
 const pipeline=createProtectedRoutePipeline({
  routes:[{method:'GET',path:'/api/fleet/tracking',tenantId:'trusted-tenant',role:'fleet'}],
  authorizeSession:async ({sessionId,tenantId,role})=>({
   ok:sessionId===sid&&tenantId==='trusted-tenant'&&role==='fleet',userId:'verified-user'
  }),
  handleAuthorized:async ({userId})=>{
   protectedCalls++;
   assert.equal(userId,'verified-user');
   return {ok:true,accessToken:'SECRET_PROVIDER_TOKEN'};
  }
 });
 const server=createServer(createNodeProtectedRouteHandler({pipeline}));
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  const valid=await fetch(origin+'/api/fleet/tracking?tenantId=attacker&role=platform',{
   headers:{cookie:'__Host-iway-session='+sid}
  });
  assert.equal(valid.status,200);
  assert.deepEqual(await valid.json(),{ok:true});
  assert.equal(valid.headers.get('cache-control'),'no-store');
  const missing=await fetch(origin+'/api/fleet/tracking');
  assert.equal(missing.status,401);
  const duplicate=await fetch(origin+'/api/fleet/tracking',{
   headers:{cookie:'__Host-iway-session='+sid+'; __Host-iway-session='+sid}
  });
  assert.equal(duplicate.status,401);
  const wrongMethod=await fetch(origin+'/api/fleet/tracking',{method:'POST'});
  assert.equal(wrongMethod.status,404);
  const traversal=await fetch(origin+'/api//fleet/tracking',{headers:{cookie:'__Host-iway-session='+sid}});
  assert.equal(traversal.status,404);
  assert.equal(protectedCalls,1);
  for(const response of [valid,missing,duplicate,wrongMethod,traversal]){
   assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  }
 }finally{
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});

test('B476 real HTTP response never reflects provider secrets on backend failure',async()=>{
 const pipeline=createProtectedRoutePipeline({
  routes:[{method:'GET',path:'/api/fleet/tracking',tenantId:'tenant',role:'fleet'}],
  authorizeSession:async()=>({ok:true,userId:'user'}),
  handleAuthorized:async()=>{throw Error('PRIVATE_REFRESH_TOKEN');}
 });
 const server=createServer(createNodeProtectedRouteHandler({pipeline}));
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/fleet/tracking',{
   headers:{cookie:'__Host-iway-session='+'s'.repeat(43)}
  });
  assert.equal(response.status,503);
  const body=await response.text();
  assert.equal(body,'{"error":"SERVICE_UNAVAILABLE"}');
  assert.ok(!body.includes('PRIVATE_REFRESH_TOKEN'));
 }finally{
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});
