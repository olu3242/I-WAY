import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';

test('B484 real chunked mutation body is bounded before protected pipeline',async()=>{
 let calls=0;
 const server=createServer(createNodeProtectedRouteHandler({
  expectedOrigin:'https://staging.iway.example',
  pipeline:async()=>{calls++;return {status:200};}
 }));
 server.listen(0,'127.0.0.1');
 try{
  await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/fleet/update';
  const send=async size=>{
   const reqHeaders={origin:'https://staging.iway.example','transfer-encoding':'chunked'};
   const body=Buffer.alloc(size,65);
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
