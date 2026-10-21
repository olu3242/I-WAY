import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,PassThrough} from 'node:stream';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
import {createNodeProtectedRouteHandler} from '../server/operations-supabase-node-protected-route.experimental.mjs';
import {readBoundedRequestBody} from '../server/operations-supabase-bounded-body.experimental.mjs';
const origin='https://staging.iway.example';
const routes=[{method:'POST',path:'/api/fleet/update',tenantId:'synthetic',role:'fleet'}];
for(const outcome of ['denied','outage','allowed','oversize','aborted'])test('B492 body ordering: '+outcome,async()=>{
 let reads=0,calls=0;const order=[];
 const pipeline=createProtectedRoutePipeline({routes,authorizeSession:async()=>{order.push('auth');if(outcome==='outage')throw Error('private');return {ok:outcome!=='denied',userId:'synthetic-user'};},handleAuthorized:async({body})=>{order.push('handler');calls++;assert.equal(body.toString(),'ok');return {ok:true};}});
 const req={method:'POST',url:'/api/fleet/update',headers:{origin,cookie:'iway_session='+'a'.repeat(43)},async *[Symbol.asyncIterator](){reads++;order.push('body');if(outcome==='aborted')this.aborted=true;yield Buffer.alloc(outcome==='oversize'?65537:2,outcome==='oversize'?65:undefined);}};
 if(outcome==='allowed')req[Symbol.asyncIterator]=async function*(){reads++;order.push('body');yield Buffer.from('ok');};
 const res={setHeader(){},end(body){this.body=body;}};
 await createNodeProtectedRouteHandler({pipeline,expectedOrigin:origin})(req,res);
 assert.equal(res.statusCode,{denied:403,outage:403,allowed:200,oversize:413,aborted:503}[outcome]);
 assert.equal(calls,outcome==='allowed'?1:0);
 if(['denied','outage'].includes(outcome))assert.equal(reads,0);
 if(outcome==='allowed')assert.deepEqual(order,['auth','body','handler']);
 assert.ok(!res.body.includes('private'));
});
test('B492 native stream timeout pauses without destroying response socket',async()=>{
 const req=new PassThrough();
 await assert.rejects(readBoundedRequestBody(req,{timeoutMs:20}),/BODY_READ_TIMEOUT/);
 assert.equal(req.destroyed,false);assert.equal(req.listenerCount('data'),0);req.destroy();
});
test('B492 native oversize rejection preserves stream for response',async()=>{
 const req=new PassThrough();
 const reading=readBoundedRequestBody(req);req.write(Buffer.alloc(65537));
 await assert.rejects(reading,/BODY_TOO_LARGE/);
 assert.equal(req.destroyed,false);req.destroy();
});

test('B488 duplicate critical headers and framed GET bodies cannot reach pipeline',async()=>{
 let calls=0;const handler=createNodeProtectedRouteHandler({pipeline:async()=>{calls++;return {status:200};}});
 for(const request of [
  {headers:{cookie:'a'},rawHeaders:['Cookie','a','cookie','b']},
  {headers:{'content-length':'1'}},
  {headers:{'transfer-encoding':'chunked'}},
  {headers:{'content-length':'0','transfer-encoding':'chunked'}}
 ]){const res={setHeader(){},end(){}};await handler({method:'GET',url:'/api/fleet/update',...request},res);assert.equal(res.statusCode,404);}
 assert.equal(calls,0);
});
