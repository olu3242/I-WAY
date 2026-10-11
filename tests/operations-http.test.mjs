import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';
async function app(t){const f=await fixture(t);const server=makeOperationsApp({store:f.store,operations:f.ops});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;return {...f,base};}
async function login(f,username){const response=await fetch(f.base+'/api/ops/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await response.json();return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}

test('protected UI, authenticated API, logout and CSRF enforcement work through HTTP',async t=>{
 const f=await app(t);
 const protectedPage=await fetch(f.base+'/app',{redirect:'manual'});assert.equal(protectedPage.status,302);
 assert.equal((await fetch(f.base+'/api/ops/state')).status,401);
 const authenticated=await login(f,f.manager.username);assert.equal(authenticated.response.status,200);
 assert.match(authenticated.response.headers.get('set-cookie'),/HttpOnly/);assert.match(authenticated.response.headers.get('set-cookie'),/SameSite=Strict/);
 const headers={Origin:f.base,'Content-Type':'application/json',Cookie:authenticated.cookie,'X-CSRF-Token':authenticated.data.csrf};
 const command={action:'fleet:create',idempotencyKey:randomUUID(),payload:{name:'Illustrative HTTP fleet'}};
 assert.equal((await fetch(f.base+'/api/ops/commands',{method:'POST',headers:{...headers,'X-CSRF-Token':'wrong'},body:JSON.stringify(command)})).status,403);
 assert.equal((await fetch(f.base+'/api/ops/commands',{method:'POST',headers:{...headers,Origin:'https://attacker.invalid'},body:JSON.stringify(command)})).status,403);
 assert.equal((await fetch(f.base+'/api/ops/commands',{method:'POST',headers,body:JSON.stringify(command)})).status,200);
 const state=await (await fetch(f.base+'/api/ops/state',{headers:{Cookie:authenticated.cookie}})).json();assert.ok(state.fleets.some(x=>x.name==='Illustrative HTTP fleet'));
 assert.equal((await fetch(f.base+'/api/ops/logout',{method:'POST',headers})).status,200);
 assert.equal((await fetch(f.base+'/api/ops/state',{headers:{Cookie:authenticated.cookie}})).status,401);
});

test('HTTP never trusts tenant, role or permission claims from the client',async t=>{
 const f=await app(t);const load=f.createLoad();const authenticated=await login(f,f.outsider.username);
 const headers={Origin:f.base,'Content-Type':'application/json',Cookie:authenticated.cookie,'X-CSRF-Token':authenticated.data.csrf};
 const command={action:'load:validate',resourceId:load.id,expectedVersion:load.version,idempotencyKey:randomUUID(),payload:{}};
 assert.equal((await fetch(f.base+'/api/ops/commands',{method:'POST',headers,body:JSON.stringify({...command,tenantId:f.manager.tenantId})})).status,422);
 assert.equal((await fetch(f.base+'/api/ops/commands',{method:'POST',headers,body:JSON.stringify(command)})).status,404);
 const state=await (await fetch(f.base+'/api/ops/state',{headers:{Cookie:authenticated.cookie}})).json();
 assert.equal(state.loads.length,0);
 assert.equal((await fetch(f.base+'/docs/SUPABASE_SETUP.md')).status,404);
});

test('account deactivation invalidates an existing session on its next request',async t=>{
 const f=await app(t);const authenticated=await login(f,f.driver.username);
 f.command(f.manager,'user:deactivate',f.driver,{reason:'Illustrative access revocation'});
 assert.equal((await fetch(f.base+'/api/ops/state',{headers:{Cookie:authenticated.cookie}})).status,401);
});
