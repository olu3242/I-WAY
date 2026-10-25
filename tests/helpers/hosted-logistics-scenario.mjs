// Synthetic identities only. Commands traverse the production hosted handler,
// authentication bridge and Operations HTTP routes; no direct domain mutations
// occur after fixture initialization.
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {randomUUID} from 'node:crypto';
import {uatApplicationFixture} from './uat-application-fixture.mjs';
import {durableUatFixture} from './durable-uat-fixture.mjs';
import {addUser} from '../../server/operations-auth.mjs';
import {createHostedUatHandler} from '../../server/operations-uat-hosted-handler.mjs';
export async function runHostedLogisticsScenario(t,{postgres}={}){
 const f=await uatApplicationFixture(t,{fullPermissions:true});
 const foreignDispatcher=addUser(f.store,{tenantId:f.outsider.tenantId,username:'foreign-dispatcher@illustrative.invalid',name:'Illustrative foreign dispatcher',role:'dispatcher',identityOnly:true});
 const foreign=f.command(f.outsider,'load:create',null,{reference:'ILL-OTHER-TENANT',customer:'Illustrative customer',dispatcherId:foreignDispatcher.id,commodity:'Illustrative goods',weightLb:1000,rateCents:10000,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative origin',at:'2026-12-01T12:00:00Z'},{type:'delivery',location:'Illustrative destination',at:'2026-12-02T12:00:00Z'}]});
 let app=postgres?await durableUatFixture(f,postgres):f.integrated;
 const server=createServer(createHostedUatHandler({createRuntime:async()=>({expiresAt:Date.now()+300000,handler:(req,res)=>app.handler(req,res),close:async()=>{}})}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const jars=new Map(['platform','carrier','fleet','driver'].map(role=>[role,new Map()]));
 async function send(role,path,{method='GET',body,csrf}={}){
  const jar=jars.get(role);
  return new Promise((resolve,reject)=>{
   const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{host:new URL(f.origin).host,origin:f.origin,cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'content-type':'application/json'}:{}),...(csrf?{'x-csrf-token':csrf}:{})}},res=>{
    for(const cookie of res.headers['set-cookie']??[]){const [name,value]=cookie.split(';')[0].split('=');if(value)jar.set(name,value);else jar.delete(name);}
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const text=Buffer.concat(chunks).toString();resolve({status:res.statusCode,text,json:()=>JSON.parse(text)});});
   });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
 }
 for(const role of jars.keys()){
  f.setLoginRole(role);assert.equal((await send(role,'/auth/login',{method:'POST'})).status,303);
  assert.equal((await send(role,'/auth/callback?code=synthetic')).status,303);
  const identity=await send(role,'/api/ops/session');assert.equal(identity.status,200);assert.equal(identity.json().actor.role,role);
 }
 const state=async role=>{const result=await send(role,'/api/ops/state');assert.equal(result.status,200);return result.json();};
 async function command(role,action,resource,payload={},key=randomUUID()){
  const identity=(await send(role,'/api/ops/session')).json();
  return send(role,'/api/ops/commands',{method:'POST',csrf:identity.csrf,body:{action,resourceId:resource?.id,expectedVersion:resource?.version,payload,idempotencyKey:key}});
 }
 async function success(role,action,resource,payload={},key){const result=await command(role,action,resource,payload,key);assert.equal(result.status,200,result.text);return result.json();}
 // Free the fixture's pre-existing assignment through an authorized HTTP command.
 await success('carrier','load:void',f.assignment,{reason:'Illustrative fixture replacement'});
 const payload={reference:'ILL-HOSTED-JOURNEY',customer:'Illustrative customer',dispatcherId:f.dispatcher.id,commodity:'Illustrative goods',weightLb:1000,rateCents:10000,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative origin',at:'2026-12-01T12:00:00Z'},{type:'delivery',location:'Illustrative destination',at:'2026-12-02T12:00:00Z'}]};
 const key=randomUUID();let load=await success('carrier','load:create',null,payload,key);
 assert.deepEqual(await success('carrier','load:create',null,payload,key),load);
 assert.equal((await state('carrier')).loads.filter(item=>item.reference===payload.reference).length,1);
 assert.ok([403,404].includes((await command('driver','load:validate',load)).status));
 assert.ok([403,404].includes((await command('fleet','load:validate',load)).status));
 assert.ok([403,404].includes((await command('platform','load:validate',load)).status));
 assert.ok([403,404].includes((await command('carrier','load:validate',foreign)).status));
 assert.ok(!(await state('carrier')).loads.some(item=>item.id===foreign.id));
 const deniedCsrf=await send('carrier','/api/ops/commands',{method:'POST',body:{action:'load:validate',resourceId:load.id,expectedVersion:load.version,payload:{},idempotencyKey:randomUUID()}});
 assert.equal(deniedCsrf.status,403);
 const initial=load;load=await success('carrier','load:validate',load);
 assert.equal((await command('carrier','load:validate',initial)).status,409);
 load=await success('carrier','load:assign',load,{driverId:f.driver.id,vehicleId:f.vehicle.id,reason:'Illustrative authorized dispatch'});
 assert.equal((await command('driver','load:deliver',load,{stopId:load.stops[1].id,proofReference:'ILL-POD'})).status,409);
 for(const [action,payload]of [['load:accept',{}],['load:pickup',{stopId:load.stops[0].id}],['load:transit',{}],['load:deliver',{stopId:load.stops[1].id,proofReference:'ILL-POD'}]])load=await success('driver',action,load,payload);
 assert.equal(load.status,'delivered');
 if(postgres){await postgres.restartDatabase();app={...app,...await app.restart()};}
 for(const role of ['carrier','fleet','driver']){
  const view=await state(role);assert.equal(view.loads.find(item=>item.id===load.id)?.status,'delivered');
  assert.equal(view.shipments.find(item=>item.loadId===load.id)?.status,'delivered');
  assert.ok(!view.loads.some(item=>item.id===foreign.id));
 }
 const replay=await success('carrier','load:create',null,payload,key);assert.equal(replay.id,load.id);
 const carrier=await state('carrier');
 assert.equal(carrier.loads.filter(item=>item.id===load.id).length,1);
 assert.equal(carrier.loads.find(item=>item.id===load.id).status,'delivered');
 assert.equal(carrier.assignments.filter(item=>item.loadId===load.id).length,1);
 assert.ok(carrier.assignments.filter(item=>item.loadId===load.id).every(item=>item.status==='ended'));
 assert.equal(carrier.audit.filter(item=>item.action==='load:create'&&item.resourceId===load.id).length,1);
 assert.equal((await send('platform','/api/ops/state')).status,403);
 return {loadId:load.id,status:load.status};
}
