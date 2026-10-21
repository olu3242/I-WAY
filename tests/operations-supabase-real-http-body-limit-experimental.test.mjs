import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';

test('B484 real chunked mutation body is bounded before protected pipeline',async()=>{
 let calls=0;
 const server=createServer(createNodeProtectedRouteHandler({
  expectedOrigin:'https://staging.iway.example',
  pipeline:createProtectedRoutePipeline({
   authorizeSession:async()=>({ok:true,userId:'synthetic-user'}),
   routes:[{method:'POST',path:'/api/fleet/update',tenantId:'synthetic-tenant',role:'fleet'}],
   handleAuthorized:async()=>{calls++;return {ok:true};}
  })
 }));
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/fleet/update';
  const send=async size=>{
   const reqHeaders={cookie:'iway_session='+ 'a'.repeat(43),origin:'https://staging.iway.example','sec-fetch-site':'same-origin'};
   const body=(async function*(){yield Buffer.alloc(size,65);})();
   const response=await fetch(url,{method:'POST',headers:reqHeaders,body,duplex:'half'});
   return response;
  };
  const tooLarge=await send(65537);
  assert.equal(tooLarge.status,413);
  assert.deepEqual(await tooLarge.json(),{error:'PAYLOAD_TOO_LARGE'});
  assert.equal(calls,0);
  const valid=await send(65536);
  assert.equal(valid.status,200);
  assert.equal(calls,1);
 }finally{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
});
