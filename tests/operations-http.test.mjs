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

test('HTTP journey connects carrier, dispatcher, driver, approval and invoicing against real persistence',async t=>{
 const f=await app(t),actors={};
 for(const [name,actor] of Object.entries({carrier:f.manager,dispatcher:f.dispatcher,driver:f.driver}))actors[name]=await login(f,actor.username);
 async function command(name,action,resource,payload={}){
  const a=actors[name],response=await fetch(f.base+'/api/ops/commands',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json',Cookie:a.cookie,'X-CSRF-Token':a.data.csrf},body:JSON.stringify({action,resourceId:resource?.id,expectedVersion:resource?.version,idempotencyKey:randomUUID(),payload})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
 }
 let load=await command('carrier','load:create',null,{reference:'ILL-HTTP-E2E',customer:'Illustrative HTTP customer',dispatcherId:f.dispatcher.id,commodity:'Illustrative goods',weightLb:100,rateCents:12500,charges:[{label:'Approved illustrative charge',amountCents:750}],factored:true,factorName:'Illustrative Factor',stops:[{type:'pickup',location:'Illustrative origin',at:'2026-11-01T12:00:00Z'},{type:'delivery',location:'Illustrative destination',at:'2026-11-02T12:00:00Z'}]});
 load=await command('dispatcher','load:validate',load);
 load=await command('dispatcher','load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Verified eligible assignment'});
 load=await command('driver','load:accept',load);
 load=await command('driver','load:pickup',load,{stopId:load.stops[0].id});
 load=await command('driver','load:transit',load);
 await command('driver','tracking:record',load,{location:'Illustrative waypoint',note:'Milestone reached'});
 await command('driver','exception:report',load,{type:'weather',reason:'Illustrative weather review'});
 let workflow=f.store.list('workflow',f.manager.tenantId)[0];await command('dispatcher','workflow:advance',workflow);
 const approval=f.store.list('approval',f.manager.tenantId)[0];await command('carrier','approval:decide',approval,{decision:'approved',reason:'Weather passed; verified safe to resume'});
 workflow=f.store.get('workflow',workflow.id,f.manager.tenantId);await command('dispatcher','workflow:advance',workflow);
 load=await command('driver','load:deliver',load,{stopId:load.stops[1].id,proofReference:'Illustrative proof'});
 let invoice=await command('carrier','finance:prepare',load);assert.equal(invoice.totalCents,13250);assert.equal(invoice.billTo,'Illustrative Factor');
 invoice=await command('carrier','finance:approve',invoice,{reason:'Reviewed approved commercial terms'});assert.equal(invoice.status,'approved');
 const response=await fetch(f.base+'/api/ops/state',{headers:{Cookie:actors.carrier.cookie}});
 const state=await response.json();assert.equal(state.loads[0].status,'delivered');assert.equal(state.invoices[0].status,'approved');assert.ok(state.audit.some(a=>a.action==='finance:approve'));
});
