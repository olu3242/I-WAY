import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';
test('B470 Node adapter strips query parameters and emits safe headers',async()=>{
 let received;
 const handler=createNodeProtectedRouteHandler({pipeline:async request=>{received=request;return {status:200,body:'{"ok":true}'};}});
 const headers={};const response={setHeader:(key,value)=>headers[key]=value,end:body=>response.body=body};
 await handler({method:'GET',url:'/api/fleet/tracking?tenantId=attacker',headers:{cookie:'iway_session=opaque'}},response);
 assert.equal(received.path,'/api/fleet/tracking');
 assert.equal(response.statusCode,200);assert.equal(headers['cache-control'],'no-store');assert.equal(headers['x-content-type-options'],'nosniff');
 assert.equal(response.body,'{"ok":true}');
});
test('B470 Node adapter returns generic 503 when pipeline throws',async()=>{
 const handler=createNodeProtectedRouteHandler({pipeline:async()=>{throw Error('SECRET_DATABASE_ERROR')}});
 const response={setHeader:()=>{},end:body=>response.body=body};
 await handler({method:'GET',url:'/api/fleet/tracking',headers:{}},response);
 assert.equal(response.statusCode,503);assert.ok(!response.body.includes('SECRET_DATABASE_ERROR'));
});

test('B471 rejects ambiguous and malformed paths without calling authorization',async()=>{
 let called=0;
 const handler=createNodeProtectedRouteHandler({pipeline:async()=>{called++;return {status:200,body:'{"ok":true}'};}});
 for(const url of ['https://evil.example/api/fleet/tracking','/api/%2fadmin','/api/%2e%2e/admin','/api/\\\\admin','/api/fleet/tracking#fragment','/api/../admin','/api/./tracking','/api/%ZZ/tracking','/api//tracking']){
  const response={setHeader:()=>{},end:body=>response.body=body};
  await handler({method:'GET',url,headers:{}},response);
  assert.equal(response.statusCode,404);
 }
 assert.equal(called,0);
});

test('B473 root-prefixed normal route reaches pipeline while interior empty segment is rejected',async()=>{
 let count=0;
 const handler=createNodeProtectedRouteHandler({pipeline:async()=>{count++;return {status:200,body:'{"ok":true}'};}});
 for(const [url,status] of [['/api/fleet/tracking',200],['/api//tracking',404]]){
  const res={setHeader:()=>{},end:()=>{}};
  await handler({method:'GET',url,headers:{}},res);
  assert.equal(res.statusCode,status);
 }
 assert.equal(count,1);
});

test('B474 adapter cannot reflect downstream response bodies',async()=>{
 const handler=createNodeProtectedRouteHandler({pipeline:async()=>({status:200,body:'{"access_token":"LEAK"}'})});
 const res={setHeader:()=>{},end:body=>res.body=body};
 await handler({method:'GET',url:'/api/fleet/tracking',headers:{}},res);
 assert.equal(res.statusCode,200);
 assert.deepEqual(JSON.parse(res.body),{ok:true});
 assert.ok(!res.body.includes('LEAK'));
});

test('B475 rejects unsupported HTTP methods without calling protected pipeline',async()=>{
 let calls=0;
 const handler=createNodeProtectedRouteHandler({pipeline:async()=>{calls++;return {status:200,body:'{"ok":true}'};}});
 for(const method of ['HEAD','OPTIONS','TRACE','CONNECT','get','']){
  const response={setHeader:()=>{},end:body=>response.body=body};
  await handler({method,url:'/api/fleet/tracking',headers:{}},response);
  assert.equal(response.statusCode,404);
 }
 assert.equal(calls,0);
});

test('B477 cookie-authenticated mutations require exact trusted Origin',async()=>{
 let calls=0;
 const handler=createNodeProtectedRouteHandler({
  expectedOrigin:'https://staging.iway.example',
  pipeline:async()=>{calls++;return {status:200,body:'{"ok":true}'};}
 });
 for(const origin of [undefined,'https://evil.example','https://staging.iway.example.evil']){
  const response={setHeader:()=>{},end:body=>response.body=body};
  await handler({method:'POST',url:'/api/fleet/tracking',headers:origin?{origin}:{}},response);
  assert.equal(response.statusCode,404);
 }
 const allowed={setHeader:()=>{},end:body=>allowed.body=body};
 await handler({method:'POST',url:'/api/fleet/tracking',headers:{origin:'https://staging.iway.example'}},allowed);
 assert.equal(allowed.statusCode,200);
 assert.equal(calls,1);
});

test('B479 cross-site Fetch Metadata blocks mutations despite matching Origin',async()=>{
 let calls=0;
 const handler=createNodeProtectedRouteHandler({
  expectedOrigin:'https://staging.iway.example',
  pipeline:async()=>{calls++;return {status:200,body:'{"ok":true}'};}
 });
 for(const fetchSite of ['cross-site','same-site','none']){
  const response={setHeader:()=>{},end:body=>response.body=body};
  await handler({method:'POST',url:'/api/fleet/tracking',headers:{
   origin:'https://staging.iway.example','sec-fetch-site':fetchSite
  }},response);
  assert.equal(response.statusCode,404);
 }
 const allowed={setHeader:()=>{},end:body=>allowed.body=body};
 await handler({method:'POST',url:'/api/fleet/tracking',headers:{
  origin:'https://staging.iway.example','sec-fetch-site':'same-origin'
 }},allowed);
 assert.equal(allowed.statusCode,200);
 assert.equal(calls,1);
});
