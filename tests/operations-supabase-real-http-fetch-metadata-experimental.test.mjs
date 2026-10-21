import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';

test('B480 actual HTTP rejects cross-site metadata even when Origin matches',async()=>{
 const sid='s'.repeat(43);
 let mutations=0;
 const pipeline=createProtectedRoutePipeline({
  routes:[{method:'POST',path:'/api/fleet/update',tenantId:'tenant-a',role:'fleet'}],
  authorizeSession:async ({sessionId,tenantId,role})=>({
   ok:sessionId===sid&&tenantId==='tenant-a'&&role==='fleet',userId:'user-a'
  }),
  handleAuthorized:async()=>{mutations++;return {ok:true};}
 });
 const server=createServer(createNodeProtectedRouteHandler({
  pipeline,expectedOrigin:'https://staging.iway.example'
 }));
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/fleet/update';
  for(const site of ['cross-site','same-site','none']){
   const response=await fetch(url,{method:'POST',headers:{
    cookie:'__Host-iway-session='+sid,origin:'https://staging.iway.example','sec-fetch-site':site
   }});
   assert.equal(response.status,404);
   assert.equal(mutations,0);
  }
  const permitted=await fetch(url,{method:'POST',headers:{
   cookie:'__Host-iway-session='+sid,origin:'https://staging.iway.example','sec-fetch-site':'same-origin'
  }});
  assert.equal(permitted.status,200);
  assert.deepEqual(await permitted.json(),{ok:true});
  assert.equal(mutations,1);
  const invalidOrigin=await fetch(url,{method:'POST',headers:{
   cookie:'__Host-iway-session='+sid,origin:'https://evil.example','sec-fetch-site':'same-origin'
  }});
  assert.equal(invalidOrigin.status,404);
  assert.equal(mutations,1);
 }finally{
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});
