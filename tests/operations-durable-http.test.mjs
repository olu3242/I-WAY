// Synthetic authenticated HTTP fault injection. Real PostgreSQL rollback is tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {uatApplicationFixture} from './helpers/uat-application-fixture.mjs';
import {createDurableUatApplication} from '../server/operations-durable-uat.mjs';
async function fixture(t,{oversized=false,commitFailure=false}={}){
 const f=await uatApplicationFixture(t),entry=f.roster.find(x=>x.role==='driver');
 const parent=await f.uat.workflow.googleSession(f.uat.tokens(entry.userId),{network:'synthetic'});
 const native=await f.integrated.bridge.establish(parent.id);let committed=0;
 const engine={validatePlatformNamespace:async()=>true,health:async()=>({storage:'postgresql'}),transaction:async(scope,work)=>{
  assert.equal(scope.tenantId,entry.tenantId);assert.equal(scope.actorId,entry.principalId);
  const operations=oversized?{state:()=>({oversized:'illustrative '.repeat(800000)})}:f.ops;
  const result=await work({store:f.store,operations});if(commitFailure)throw Error('synthetic commit failure');committed++;return result;
 }};
 const app=await createDurableUatApplication({...f.dependencies,engine,platformNamespaceId:f.governance});
 const server=createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const send=(path,{authenticated=true}={})=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path,headers:{host:new URL(f.origin).host,...(authenticated?{cookie:'__Host-iway-session='+parent.id+'; '+native.split(';')[0]}:{})}},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end();
 });
 return {send,committed:()=>committed};
}
test('durable HTTP never emits a successful state response when persistence fails',async t=>{
 const f=await fixture(t,{commitFailure:true}),r=await f.send('/api/ops/state');assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'UNAVAILABLE'});assert.equal(f.committed(),0);
});
test('oversized upstream state fails closed without hanging or committing',async t=>{
 const f=await fixture(t,{oversized:true}),r=await f.send('/api/ops/state');assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'UNAVAILABLE'});assert.equal(f.committed(),0);
});
test('durable signed-out pages redirect to approved login while APIs deny access',async t=>{
 const f=await fixture(t);for(const path of ['/','/app','/admin','/login']){const r=await f.send(path,{authenticated:false});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/uat/login');}
 assert.equal((await f.send('/api/ops/state',{authenticated:false})).status,401);assert.equal(f.committed(),0);
});
