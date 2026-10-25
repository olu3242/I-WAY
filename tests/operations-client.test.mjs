// Client logic tests with a minimal DOM harness, NOT browser or visual certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {fixture,password} from './helpers/operations-fixture.mjs';
import {makeOperationsApp} from '../server/operations-app.mjs';
const source=await readFile(new URL('../apps/operations/ops.js',import.meta.url),'utf8');
async function client(t,f,actor,{dropFirstCommand=false}={}){
 const server=makeOperationsApp({store:f.store,operations:f.ops});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const response=await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:actor.username,password})});
 assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn},scrollIntoView(){}});return elements.get(id)};
 let dropped=false;const context=createContext({CustomEvent,document:Object.assign(new EventTarget(),{querySelector:element}),crypto:webcrypto,Intl,Date,console,location:{assign(){throw new Error('Unexpected signout')}},fetch:async(path,options={})=>{
  const result=await fetch(base+path,{...options,headers:{...options.headers,Origin:base,Cookie:cookie}});
  if(dropFirstCommand&&!dropped&&path==='/api/ops/commands'){dropped=true;await result.text();throw new Error('Illustrative lost response')}
  return result;
 }});
 runInContext(source.replace('\nrefresh().catch(error=>alertMessage(error.message,true));','globalThis.initialized=refresh();'),context);
 await context.initialized;
 return {context,element,run:code=>runInContext(code,context)};
}
test('client commands reuse their idempotency key after a lost response and render the persisted result',async t=>{
 const f=await fixture(t),c=await client(t,f,f.manager,{dropFirstCommand:true});
 const operation="command('fleet:create',null,{name:'Illustrative response recovery'})";
 await assert.rejects(c.run(operation),/lost response/);
 await c.run(operation);
 assert.equal(f.store.list('fleet',f.manager.tenantId).filter(x=>x.name==='Illustrative response recovery').length,1);
 assert.equal(c.run("state.fleets.filter(x=>x.name==='Illustrative response recovery').length"),1);
 assert.match(c.run("people()"),/Illustrative response recovery/);
});
test('all persona views render from real API state and fleet creation uses its own employment action',async t=>{
 const f=await fixture(t);f.assign();
 for(const actor of [f.manager,f.dispatcher,f.driver,f.fleetUser]){
  const c=await client(t,f,actor);
  assert.match(c.element('#view').innerHTML,/<h1>/);assert.doesNotMatch(c.element('#view').innerHTML,/undefined|NaN/);
  for(const view of ['loads','assets','workflows','finance','audit','people'])await c.run("tab="+JSON.stringify(view)+";render()");
  if(actor.role==='fleet'){assert.match(c.element('#view').innerHTML,/Fleet employment/);assert.match(c.element('#view').innerHTML,/id="fleet-driver"/)}
  if(actor.role==='carrier'){
   assert.match(c.run("createLoad()"),/Additional charge/);
   assert.doesNotMatch(c.run("select('fleetId','Owner',[['','Carrier']])"),/required/);
  }
  c.run('tab="loads";selected=state.loads[0]?.id??null;render()');
  if(actor.role==='driver'){assert.match(c.element('#view').innerHTML,/Accept assignment/);assert.doesNotMatch(c.element('#view').innerHTML,/Base charge/)}
 }
});
test('client rendering escapes saved user input rather than interpreting it as markup',async t=>{
 const f=await fixture(t),load=f.createLoad();
 // Fixture setup writes a value the real API's bounded text fields permit.
 f.store.update('load',load.id,f.manager.tenantId,load.version,{reference:'<img src=x onerror=alert(1)>'});
 const c=await client(t,f,f.manager);
 assert.match(c.element('#view').innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(c.element('#view').innerHTML,/<img src=x/);
});
