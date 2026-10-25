import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedUatHandler} from '../server/operations-uat-hosted-handler.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const response=()=>({headersSent:false,destroyed:false,writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;},end(body){this.body=body;},destroy(){this.destroyed=true;}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('hosted concurrent cold starts share initialization and rotate expired runtimes',async()=>{
 const ready=deferred();let starts=0,closed=0,now=1;
 const handler=createHostedUatHandler({clock:()=>now,createRuntime:async()=>{starts++;await ready.promise;return {expiresAt:now+10,close:async()=>{closed++;},handler:async(req,res)=>{res.writeHead(200,{});res.end('ok');}};}});
 const a=response(),b=response(),requests=[handler({},a),handler({},b)];await tick();assert.equal(starts,1);ready.resolve();await Promise.all(requests);
 assert.equal(a.status,200);assert.equal(b.status,200);now=12;await handler({},response());await tick();assert.equal(starts,2);assert.equal(closed,1);
});
test('failed generation drains active requests before closing and next request recovers',async()=>{
 const entered=deferred(),finish=deferred();let starts=0,closed=0;
 const handler=createHostedUatHandler({clock:()=>0,logSink:()=>{},createRuntime:async()=>{starts++;return {expiresAt:10,close:async()=>{closed++;},handler:async(req,res)=>{if(req.slow){entered.resolve();await finish.promise;}if(req.fail)throw Error('private provider detail');res.writeHead(200,{});res.end('ok');}};}});
 const slow=response(),pending=handler({slow:true},slow);await entered.promise;
 const failed=response();await handler({fail:true},failed);assert.equal(failed.status,503);assert.equal(closed,0);assert.equal(failed.body,'{"error":"UAT_UNAVAILABLE"}');
 await handler({},response());assert.equal(starts,2);finish.resolve();await pending;await tick();assert.equal(closed,1);assert.equal(slow.status,200);
});
test('startup and logging failures remain sanitized and retryable',async()=>{
 let calls=0;
 const handler=createHostedUatHandler({logSink:()=>{throw Error('logger unavailable');},createRuntime:()=>{if(++calls===1)throw Error('private database detail');return {expiresAt:Date.now()+10000,close:async()=>{},handler:async(req,res)=>res.writeHead(204,{})};}});
 const failed=response();await handler({},failed);assert.equal(failed.status,503);assert.equal(failed.headers['cache-control'],'no-store');assert.ok(failed.headers['x-request-id']);assert.ok(!failed.body.includes('private'));
 const recovered=response();await handler({},recovered);assert.equal(recovered.status,204);
});
test('partial responses are aborted; invalid expiry never serves requests',async()=>{
 let closes=0,served=0;
 const handler=createHostedUatHandler({logSink:()=>{},createRuntime:async()=>({expiresAt:NaN,close:async()=>{closes++;},handler:async()=>{served++;}})});
 const denied=response();await handler({},denied);await tick();assert.equal(denied.status,503);assert.equal(served,0);assert.equal(closes,2);
 const partial=createHostedUatHandler({createRuntime:async()=>({expiresAt:Date.now()+10000,close:async()=>{},handler:async(req,res)=>{res.writeHead(200,{});throw Error('failed');}})});
 const res=response();await partial({},res);assert.equal(res.destroyed,true);assert.equal(res.body,undefined);
});
