import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';

async function setup(t,trackingProjection){
 const f=await fixture(t),server=makeOperationsApp({store:f.store,operations:f.ops,trackingProjection});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 async function login(username){
  const r=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(r.status,200);
  return r.headers.get('set-cookie').split(';')[0];
 }
 return {...f,base,login};
}
const validId=randomUUID();
test('R5 tracking HTTP boundary enforces session, tenant scope, cursor and fail-closed adapter',async t=>{
 const calls=[];
 const projection=async input=>{
  calls.push(input);
  return {shipmentId:input.shipmentId,history:[],hasMore:false,nextCursor:null,latestLocation:null};
 };
 const f=await setup(t,projection),url=f.base+'/api/ops/tracking/'+validId;
 const carrier=await f.login(f.manager.username);
 const dispatcher=await f.login(f.dispatcher.username);
 const get=(path=url,cookie=carrier)=>fetch(path,{headers:cookie?{Cookie:cookie}:{}});
 assert.equal((await get(url,null)).status,401); // 1
 assert.equal((await get(url,'iway_ops=invalid')).status,401); // 2
 assert.equal((await get(url)).status,200); // 3
 assert.equal(calls.length,1); // 4
 assert.equal(calls[0].scope.tenantId,f.manager.tenantId); // 5
 assert.equal(calls[0].scope.actorId,f.manager.id); // 6
 assert.equal(calls[0].limit,20); // 7
 assert.equal(calls[0].before,null); // 8
 assert.equal((await get(url+'?limit=1')).status,200); // 9
 assert.equal(calls.at(-1).limit,1); // 10
 assert.equal((await get(url+'?limit=200')).status,200); // 11
 assert.equal(calls.at(-1).limit,200); // 12
 for(const bad of ['0','201','1.5','NaN'])assert.equal((await get(url+'?limit='+bad)).status,400); // 13-16
 assert.equal((await get(f.base+'/api/ops/tracking/not-uuid')).status,400); // 17
 assert.equal((await get(url+'?before=invalid')).status,400); // 18
 const before={shipmentId:validId,occurredAt:'2026-11-01T10:00:00.000Z',id:randomUUID()};
 assert.equal((await get(url+'?before='+Buffer.from(JSON.stringify(before)).toString('base64url'))).status,200); // 19
 assert.deepEqual(calls.at(-1).before,before); // 20
 assert.equal((await get(url+'?before='+Buffer.from(JSON.stringify({...before,shipmentId:randomUUID()})).toString('base64url'))).status,400);
 assert.equal((await get(url,dispatcher)).status,200);
 assert.equal(calls.at(-1).scope.actorId,f.dispatcher.id);
 assert.equal(calls.at(-1).scope.tenantId,f.dispatcher.tenantId);
 assert.equal(calls.at(-1).actor.id,f.dispatcher.id);
});
test('R5 tracking HTTP endpoint fails closed on absent adapter and projection errors',async t=>{
 const f=await setup(t,null),cookie=await f.login(f.manager.username),url=f.base+'/api/ops/tracking/'+validId;
 assert.equal((await fetch(url,{headers:{Cookie:cookie}})).status,503);
 const errors=[['FORBIDDEN',403],['UNAUTHORIZED',401],['INVALID_PAGE',400],['NOT_FOUND',404],['UNKNOWN',503]];
 for(const [code,status] of errors){
  const scoped=await setup(t,async()=>{throw Object.assign(Error('hidden'),{code})});
  const auth=await scoped.login(scoped.manager.username);
  const response=await fetch(scoped.base+'/api/ops/tracking/'+validId,{headers:{Cookie:auth}});
  assert.equal(response.status,status);
  assert.equal((await response.json()).error,'Tracking request unavailable.');
 }
});
