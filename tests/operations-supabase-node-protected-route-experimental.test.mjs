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
