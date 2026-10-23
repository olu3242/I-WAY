import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers/operations-fixture.mjs';
import {Operations} from '../domain/operations.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {exportTenantState,materializeTenantState} from '../server/operations-durable-postgres.mjs';
import {advanceDurableAdvisories} from '../server/operations-durable-worker.mjs';

async function setup(t){
 const f=await fixture(t,{...createOperationsFeatures(),now:()=>new Date('2026-11-02T14:00:00.000Z')}),load=f.assign();
 const source=exportTenantState(f.store,f.manager.tenantId),store=materializeTenantState(source.payload,source.audit);
 t.after(()=>store.close());
 const ops=new Operations(store,{...createOperationsFeatures(),now:()=>new Date('2026-11-02T14:00:00.000Z')});
 const command=(actor,action,resource,payload={})=>ops.execute(actor.id,{action,resourceId:resource?.id,expectedVersion:resource?.version,payload,idempotencyKey:randomUUID()});
 return {...f,load,store,ops,command};
}
test('bounded durable command worker completes five honest advisory checkpoints with audit and no shipment mutation',async t=>{
 const f=await setup(t),job=f.command(f.manager,'orchestration:request',f.load);
 assert.deepEqual(await advanceDurableAdvisories(f.ops),{workflowProgress:0,advisoryCheckpoints:5,externalCalls:0});
 assert.equal(f.store.get('orchestration',job.id,f.manager.tenantId).status,'completed');
 const decisions=f.store.list('agentdecision',f.manager.tenantId);assert.equal(decisions.length,5);
 assert.ok(decisions.every(record=>record.provenance.model===null&&record.provenance.live===false&&record.consequentialAction===false&&record.decisionGovernance.executionPerformed===false));
 assert.deepEqual(f.store.get('load',f.load.id,f.manager.tenantId),f.load);
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='runtime:decision'").get().n,5);
 assert.equal(f.store.list('invoice',f.manager.tenantId).length,0);
});
test('bounded worker requests independent approval and stops until an authorized human decides',async t=>{
 const f=await setup(t),exception=f.command(f.driver,'exception:report',f.load,{type:'delay',reason:'Illustrative report requires carrier confirmation'});
 assert.equal((await advanceDurableAdvisories(f.ops)).workflowProgress,1);
 const approval=f.store.list('approval',f.manager.tenantId).at(-1);assert.equal(approval.status,'pending');
 assert.equal(f.store.get('exception',exception.id,f.manager.tenantId).status,'open');
 assert.equal((await advanceDurableAdvisories(f.ops)).workflowProgress,0);
 assert.equal(f.store.get('approval',approval.id,f.manager.tenantId).status,'pending');
 f.command(f.manager,'approval:decide',approval,{decision:'approved',reason:'Illustrative independent carrier verification'});
 assert.equal((await advanceDurableAdvisories(f.ops)).workflowProgress,1);
 assert.equal(f.store.get('approval',approval.id,f.manager.tenantId).status,'applied');
 assert.equal(f.store.get('exception',exception.id,f.manager.tenantId).status,'resolved');
 assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM audit WHERE action='approval:decide'").get().n,1);
});
test('worker progresses one advisory job within five steps and leaves external connectors untouched',async t=>{
 const f=await setup(t),first=f.command(f.manager,'orchestration:request',f.load);
 const next=f.command(f.manager,'load:create',null,{reference:'ILL-WORKER-BOUND',customer:'Illustrative customer',dispatcherId:f.dispatcher.id,commodity:'Illustrative freight',weightLb:1000,rateCents:10000,charges:[],factored:false,stops:[{type:'pickup',location:'Illustrative pickup',at:'2026-11-02T14:00:00.000Z'},{type:'delivery',location:'Illustrative delivery',at:'2026-11-03T14:00:00.000Z'}]});
 const second=f.command(f.manager,'orchestration:request',next);
 const connector=f.command(f.manager,'connector:request',f.load,{capability:'communications',input:{source:'local_fixture',template:'shipment_status',recipientId:f.driver.id}});
 assert.equal((await advanceDurableAdvisories(f.ops,{limit:2})).advisoryCheckpoints,2);
 assert.equal(f.store.get('orchestration',first.id,f.manager.tenantId).checkpoint,2);
 assert.equal(f.store.get('orchestration',second.id,f.manager.tenantId).checkpoint,0);
 assert.equal((await advanceDurableAdvisories(f.ops)).advisoryCheckpoints,3);
 assert.equal(f.store.get('orchestration',second.id,f.manager.tenantId).checkpoint,0);
 assert.equal(f.store.get('connectorjob',connector.id,f.manager.tenantId).status,'pending');
 assert.equal(f.store.list('connectorresult',f.manager.tenantId).length,0);
 await assert.rejects(advanceDurableAdvisories(f.ops,{limit:6}),TypeError);
 await assert.rejects(advanceDurableAdvisories(f.ops,{limit:0}),TypeError);
});
test('a pending human approval does not starve the next bounded exception review',async t=>{
 const f=await setup(t);
 f.command(f.driver,'exception:report',f.load,{type:'delay',reason:'Illustrative first independent human review'});
 await advanceDurableAdvisories(f.ops);
 f.command(f.driver,'exception:report',f.load,{type:'weather',reason:'Illustrative second condition needs its own review'});
 assert.equal(f.store.list('approval',f.manager.tenantId).length,1);
 const result=await advanceDurableAdvisories(f.ops);assert.equal(result.workflowProgress,1);
 assert.equal(f.store.list('approval',f.manager.tenantId).length,2);
 assert.ok(f.store.list('approval',f.manager.tenantId).every(record=>record.status==='pending'));
 assert.ok(f.store.list('exception',f.manager.tenantId).every(record=>record.status==='open'));
});
test('worker rejects multi-tenant execution and rechecks current requester authority',async t=>{
 const f=await setup(t);
 const multi=new Operations(f.store,{...createOperationsFeatures()});
 const tenant=randomUUID();f.store.db.prepare('INSERT INTO tenants VALUES(?,?,?)').run(tenant,'Illustrative extra fixture','UTC');
 await assert.rejects(advanceDurableAdvisories(multi),/SINGLE_TENANT_TRANSACTION_REQUIRED/);
 f.store.db.prepare('DELETE FROM tenants WHERE id=?').run(tenant);
 const job=f.command(f.dispatcher,'orchestration:request',f.load),actor=f.store.principal(f.dispatcher.id);
 f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...actor,permissions:actor.permissions.filter(permission=>permission!=='orchestration:manage')}),actor.id);
 assert.equal((await advanceDurableAdvisories(f.ops)).advisoryCheckpoints,0);
 assert.equal(f.store.get('orchestration',job.id,f.manager.tenantId).status,'blocked');
 assert.equal(f.store.list('agentdecision',f.manager.tenantId).length,0);
});
