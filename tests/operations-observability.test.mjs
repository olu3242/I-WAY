import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,password} from './helpers/operations-fixture.mjs';import {makeOperationsApp} from '../server/operations-app.mjs';import {createOperationsFeatures} from '../domain/operations-features.mjs';
test('HTTP correlation and structured events never retain paths, credentials, tenant identity or request input',async t=>{
 const f=await fixture(t,createOperationsFeatures()),events=[],server=makeOperationsApp({store:f.store,operations:f.ops,logSink:e=>events.push(e)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const response=await fetch(base+'/unknown-private-path?password=PRIVATE',{headers:{'x-correlation-id':'PRIVATE-CORRELATION'}});
  assert.match(response.headers.get('x-correlation-id'),/^[0-9a-f-]{36}$/);assert.notEqual(response.headers.get('x-correlation-id'),'PRIVATE-CORRELATION');
  assert.equal((await fetch(base+'/health')).status,200);
  await fetch(base+'/api/ops/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'private@example.invalid',password:'PRIVATE'})});
  await new Promise(r=>setImmediate(r));const log=JSON.stringify(events);
  for(const value of ['PRIVATE','private@example.invalid','unknown-private-path',f.manager.tenantId])assert.ok(!log.includes(value));
  assert.ok(events.some(e=>e.category==='authentication'));assert.ok(events.every(e=>Number.isFinite(e.durationMs)));
 }finally{await new Promise(r=>server.close(r))}
});
test('health alerts show only currently authorized tenant shipments and actionable bounded metadata',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.createLoad(),j=f.command(f.manager,'orchestration:request',load);
 f.store.update('orchestration',j.id,f.manager.tenantId,j.version,{status:'dead_letter'});
 assert.equal(f.ops.state(f.manager.id).workflowHealth.counts.deadLetter,1);
 assert.equal(f.ops.state(f.dispatcher.id).workflowHealth.alerts[0].code,'DEAD_LETTER');
 assert.equal(f.ops.state(f.otherDispatcher.id).workflowHealth.counts.deadLetter,0);
 assert.equal(f.ops.state(f.outsider.id).workflowHealth.counts.deadLetter,0);assert.equal(f.ops.state(f.driver.id).workflowHealth,null);
});
