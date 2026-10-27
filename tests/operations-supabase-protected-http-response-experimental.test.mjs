import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtectedHttpHandler} from '../server/operations-supabase-protected-http-response.experimental.mjs';
test('B468 emits no provider tokens or internal auth details',async()=>{
 const handler=createProtectedHttpHandler({authorizeRequest:async()=>({ok:true,status:200,userId:'user-1',accessToken:'SECRET'}),handleAuthorized:async()=>({ok:true,refreshToken:'REFRESH'})});
 const result=await handler({method:'GET',path:'/api/tracking'});
 assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body),{ok:true});
 assert.equal(result.headers['cache-control'],'no-store');
 assert.ok(!JSON.stringify(result).includes('SECRET'));
 assert.ok(!JSON.stringify(result).includes('REFRESH'));
});
test('B468 denies unauthorized requests and fails closed on handler outage',async()=>{
 const denied=createProtectedHttpHandler({authorizeRequest:async()=>({ok:false,status:403}),handleAuthorized:async()=>{throw Error('must not execute')}});
 assert.equal((await denied({method:'GET',path:'/api/tracking'})).status,403);
 const outage=createProtectedHttpHandler({authorizeRequest:async()=>({ok:true,userId:'user'}),handleAuthorized:async()=>{throw Error('db down')}});
 assert.equal((await outage({method:'GET',path:'/api/tracking'})).status,503);
});
