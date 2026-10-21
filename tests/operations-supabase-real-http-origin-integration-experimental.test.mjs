import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';

test('B478 actual HTTP mutation requires exact configured Origin',async()=>{
 const sid='s'.repeat(43);
 let writes=0;
 const pipeline=createProtectedRoutePipeline({
  routes:[{method:'POST',path:'/api/fleet/update',tenantId:'tenant-a',role:'fleet'}],
  authorizeSession:async ({sessionId,tenantId,role})=>({
   ok:sessionId===sid&&tenantId==='tenant-a'&&role==='fleet',userId:'user-a'
  }),
  handleAuthorized:async()=>{writes++;return {ok:true};}
 });
 const handler=createNodeProtectedRouteHandler({pipeline,expectedOrigin:'https://staging.iway.example'});
 const server=createServer(handler);
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/fleet/update';
  for(const origin of [undefined,'https://attacker.example','https://staging.iway.example.attacker']){
   const response=await fetch(url,{method:'POST',headers:{
    cookie:'iway_session='+sid,...(origin?{origin}:{})
   }});
   assert.equal(response.status,404);
   assert.equal(response.headers.get('cache-control'),'no-store');
   assert.equal(writes,0);
  }
  const allowed=await fetch(url,{method:'POST',headers:{
   cookie:'iway_session='+sid,origin:'https://staging.iway.example'
  }});
  assert.equal(allowed.status,200);
  assert.deepEqual(await allowed.json(),{ok:true});
  assert.equal(writes,1);
  const unauthenticated=await fetch(url,{method:'POST',headers:{origin:'https://staging.iway.example'}});
  assert.equal(unauthenticated.status,401);
  assert.equal(writes,1);
 }finally{
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});
