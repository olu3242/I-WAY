import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';

test('FCC-03 offline session binding is driver-only, session-scoped, and revoked on logout',async t=>{
 const f=await fixture(t);
 const server=makeOperationsApp({store:f.store,operations:f.ops});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const endpoint=base+'/api/ops/offline-session';
 assert.equal((await fetch(endpoint)).status,401);
 async function login(actor){
  const response=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:actor.username,password})});
  assert.equal(response.status,200);
  return {cookie:response.headers.get('set-cookie').split(';')[0],...(await response.json())};
 }
 const carrier=await login(f.manager);
 assert.equal((await fetch(endpoint,{headers:{Cookie:carrier.cookie}})).status,403);
 const driver=await login(f.driver);
 const headers={Cookie:driver.cookie};
 const first=await fetch(endpoint,{headers});
 assert.equal(first.status,200);
 assert.equal(first.headers.get('cache-control'),'no-store');
 const identity=await first.json();
 assert.deepEqual(Object.keys(identity).sort(),['active','actorId','replayEnabled','scope','sessionId','tenantId'].sort());
 assert.equal(identity.active,true);
 assert.equal(identity.actorId,f.driver.id);
 assert.equal(identity.tenantId,f.driver.tenantId);
 assert.equal(identity.replayEnabled,false);
 assert.match(identity.sessionId,/^[a-f0-9]{64}$/);
 const again=await (await fetch(endpoint,{headers})).json();
 assert.equal(again.sessionId,identity.sessionId);
 const another=await login(f.driver);
 const separate=await (await fetch(endpoint,{headers:{Cookie:another.cookie}})).json();
 assert.notEqual(separate.sessionId,identity.sessionId);
 const out=await fetch(base+'/api/ops/logout',{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json','X-CSRF-Token':driver.csrf},body:'{}'});
 assert.equal(out.status,200);
 assert.equal((await fetch(endpoint,{headers})).status,401);
 assert.equal((await fetch(endpoint,{headers:{Cookie:another.cookie}})).status,200);
});
