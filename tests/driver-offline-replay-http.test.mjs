import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';

test('FCC-03 replay requires driver session, rejects cross-session and duplicate effects',async t=>{
 const f=await fixture(t);
 const assigned=f.assign();
 const server=makeOperationsApp({store:f.store,operations:f.ops});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 async function login(actor){
  const response=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:actor.username,password})});
  assert.equal(response.status,200);
  return {cookie:response.headers.get('set-cookie').split(';')[0],...(await response.json())};
 }
 const driver=await login(f.driver),other=await login(f.driver),carrier=await login(f.manager);
 const identity=await (await fetch(base+'/api/ops/offline-session',{headers:{Cookie:driver.cookie}})).json();
 const entry={schemaVersion:1,tenantId:identity.tenantId,actorId:identity.actorId,sessionId:identity.sessionId,
  action:'load:accept',resourceId:assigned.id,expectedVersion:assigned.version,idempotencyKey:randomUUID(),createdAt:Date.now(),payload:{}};
 const send=(auth,body)=>fetch(base+'/api/ops/offline-replay',{method:'POST',headers:{Origin:base,Cookie:auth.cookie,'X-CSRF-Token':auth.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await send(carrier,entry)).status,403);
 assert.notEqual((await send(other,entry)).status,200);
 assert.equal(f.ops.read('load',assigned.id,f.driver).status,'assigned');
 const first=await send(driver,entry);
 assert.equal(first.status,200);
 assert.equal((await first.json()).idempotencyKey,entry.idempotencyKey);
 const accepted=f.ops.read('load',assigned.id,f.driver);
 assert.equal(accepted.status,'accepted');
 const again=await send(driver,entry);
 assert.equal(again.status,200);
 assert.equal((await again.json()).idempotencyKey,entry.idempotencyKey);
 assert.equal(f.ops.read('load',assigned.id,f.driver).version,accepted.version);
 const stale={...entry,idempotencyKey:randomUUID()};
 assert.notEqual((await send(driver,stale)).status,200);
 assert.equal(f.ops.read('load',assigned.id,f.driver).version,accepted.version);
});
