// Shared semantic assertions for the real disposable PostgreSQL domain-engine suite.
// The caller owns its explicit restricted database fixture; this helper never reads env files.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {claimJob,completeJob,executeAdvisory,failJob} from '../../domain/operations-runtime.mjs';
import {runWorkflowTick} from '../../domain/operations-automation.mjs';

export async function runAgenticDurabilityScenarios(t,{transact,restart,fixture:f}){
 const scope=actor=>({tenantId:actor.tenantId,actorId:actor.id});
 const manager=scope(f.manager),dispatcher=scope(f.dispatcher),driver=scope(f.driver);
 const current=(ops,kind,id)=>ops.store.get(kind,id,f.manager.tenantId);
 const execute=(ops,actor,action,resource,payload={},key=randomUUID())=>ops.execute(actor.id,{action,resourceId:resource?.id,expectedVersion:resource?.version,payload,idempotencyKey:key});
 const command=(actor,action,resource,payload={},key)=>transact(scope(actor),ops=>execute(ops,actor,action,resource,payload,key));
 const get=(kind,id)=>transact(manager,ops=>current(ops,kind,id));
 let load=f.load;

 await t.test('B665 five deterministic advisory handoffs survive PostgreSQL engine recreation and replay',async()=>{
  const key=randomUUID();
  const job=await command(f.manager,'orchestration:request',load,{},key);
  assert.deepEqual(job.plan.map(step=>step.role),['dispatch','tracking','documents','exceptions','finance']);
  await restart();
  assert.deepEqual(await command(f.manager,'orchestration:request',load,{},key),job);
  let lastClaim;
  for(let checkpoint=0;checkpoint<job.plan.length;checkpoint++){
   const held=await transact(manager,ops=>claimJob(ops,{tenantId:manager.tenantId,kind:'orchestration',jobId:job.id,workerId:'b665-checkpoint-'+checkpoint}));
   assert.equal(held.checkpoint,checkpoint);
   const output=await transact(manager,ops=>executeAdvisory(ops,held));
   assert.equal(output.provenance.model,null);assert.equal(output.provenance.live,false);assert.equal(output.consequentialAction,false);
   await restart();
   const completed=await transact(manager,ops=>completeJob(ops,held,output));
   assert.equal(completed.accepted,true);assert.equal(completed.job.checkpoint,checkpoint+1);lastClaim={held,output};
  }
  await restart();
  assert.equal((await get('orchestration',job.id)).status,'completed');
  assert.deepEqual(await transact(manager,ops=>completeJob(ops,lastClaim.held,lastClaim.output)),{accepted:false,reason:'LEASE_STALE'});
  await transact(manager,ops=>{
   const decisions=ops.store.list('agentdecision',manager.tenantId).filter(item=>item.jobId===job.id);
   assert.equal(decisions.length,5);assert.equal(new Set(decisions.map(item=>item.fence)).size,5);
   assert.ok(decisions.every(item=>item.decisionGovernance.executionPerformed===false&&item.decisionGovernance.aiDecision.status==='BLOCKED'));
   assert.deepEqual(current(ops,'load',load.id),load);
   assert.equal(ops.store.list('invoice',manager.tenantId).filter(item=>item.loadId===load.id).length,0);
   const audit=ops.store.db.prepare('SELECT action FROM audit WHERE tenant_id=?').all(manager.tenantId).map(item=>item.action);
   for(const action of ['orchestration:request','runtime:claim','runtime:decision','runtime:checkpoint'])assert.ok(audit.includes(action),action);
   assert.throws(()=>ops.store.update('agentdecision',decisions[0].id,manager.tenantId,decisions[0].version,{consequentialAction:true}),/immutable/i);
  });
  if(f.outsider)await assert.rejects(transact(scope(f.outsider),ops=>ops.store.get('orchestration',job.id,f.outsider.tenantId)),error=>error.code==='NOT_FOUND');
 });

 await t.test('B665 approved exception recovery remains human governed across PostgreSQL restart',async()=>{
  const exception=await command(f.dispatcher,'exception:report',load,{type:'delay',reason:'Illustrative B665 road closure; independent human confirmation required'});
  await transact(dispatcher,ops=>runWorkflowTick(ops));await restart();
  const review=await transact(manager,ops=>ops.store.list('approval',manager.tenantId).find(item=>item.loadId===load.id&&item.status==='pending'));
  assert.ok(review);assert.equal((await get('exception',exception.id)).status,'open');
  await assert.rejects(command(f.driver,'approval:decide',review,{decision:'approved',reason:'Driver cannot approve own operational recovery'}),error=>error.status===403);
  await command(f.manager,'approval:decide',review,{decision:'approved',reason:'Illustrative carrier independently verifies reopened route'});
  await restart();
  assert.equal((await get('exception',exception.id)).status,'open');
  await transact(manager,ops=>runWorkflowTick(ops));await restart();
  assert.equal((await get('exception',exception.id)).status,'resolved');
  assert.equal((await get('approval',review.id)).status,'applied');
  await transact(manager,ops=>{
   const rows=ops.store.db.prepare('SELECT actor_id AS actorId,action FROM audit WHERE tenant_id=? AND resource_id=?').all(manager.tenantId,review.id);
   assert.ok(rows.some(item=>item.action==='approval:decide'&&item.actorId===f.manager.id));
   assert.equal(rows.filter(item=>item.action==='approval:apply').length,1);
   assert.deepEqual(current(ops,'load',load.id),load);
  });
 });

 await t.test('B665 dead-letter recovery is durable, sanitized and requires authorized human reauthorization',async()=>{
  const job=await command(f.dispatcher,'orchestration:request',load),failure='B665_PRIVATE_PROVIDER_FAILURE_MUST_NOT_PERSIST';
  const held=await transact(dispatcher,ops=>claimJob(ops,{tenantId:manager.tenantId,kind:'orchestration',jobId:job.id,workerId:'b665-failure'}));
  await transact(dispatcher,ops=>failJob(ops,held,new Error(failure)));await restart();
  const dead=await get('orchestration',job.id);assert.equal(dead.status,'dead_letter');assert.equal(dead.lastError,'STEP_FAILURE');
  await transact(manager,ops=>{
   assert.ok(!JSON.stringify(ops.store.db.prepare('SELECT data FROM resources WHERE tenant_id=?').all(manager.tenantId)).includes(failure));
   assert.ok(!JSON.stringify(ops.store.db.prepare('SELECT detail FROM audit WHERE tenant_id=?').all(manager.tenantId)).includes(failure));
  });
  await assert.rejects(command(f.driver,'orchestration:retry',dead,{reason:'Driver has no reauthorization grant'}),error=>error.status===403);
  const retry=await command(f.dispatcher,'orchestration:retry',dead,{reason:'Illustrative dispatcher reviewed safe deterministic recovery'});assert.equal(retry.runNumber,2);
  await restart();
  for(let checkpoint=0;checkpoint<retry.plan.length;checkpoint++){
   await transact(dispatcher,ops=>{
    const claim=claimJob(ops,{tenantId:manager.tenantId,kind:'orchestration',jobId:job.id,workerId:'b665-recovery'});
    assert.ok(claim);assert.equal(completeJob(ops,claim,executeAdvisory(ops,claim)).accepted,true);
   });
  }
  await restart();assert.equal((await get('orchestration',job.id)).status,'completed');
  assert.equal(await transact(manager,ops=>ops.store.list('agentdecision',manager.tenantId).filter(item=>item.jobId===job.id&&item.runNumber===1).length),0);
 });

 await t.test('B665 cancellation fences a recovered worker and denies consequential output injection',async()=>{
  const job=await command(f.manager,'orchestration:request',load);
  const held=await transact(manager,ops=>claimJob(ops,{tenantId:manager.tenantId,kind:'orchestration',jobId:job.id,workerId:'b665-cancel'}));
  const output=await transact(manager,ops=>executeAdvisory(ops,held));
  await command(f.manager,'orchestration:cancel',await get('orchestration',job.id),{reason:'Illustrative carrier cancels before recovered worker completion'});await restart();
  assert.deepEqual(await transact(manager,ops=>completeJob(ops,held,output)),{accepted:false,reason:'LEASE_STALE'});
  const next=await command(f.manager,'orchestration:request',load);
  const lease=await transact(manager,ops=>claimJob(ops,{tenantId:manager.tenantId,kind:'orchestration',jobId:next.id,workerId:'b665-injection'}));
  const valid=await transact(manager,ops=>executeAdvisory(ops,lease));
  const result=await transact(manager,ops=>completeJob(ops,lease,{...valid,tool:'load:assign',consequentialAction:true}));
  assert.deepEqual(result,{accepted:false,reason:'EVIDENCE_CHANGED'});await restart();
  assert.equal((await get('orchestration',next.id)).status,'blocked');assert.deepEqual(await get('load',load.id),load);
  assert.equal(await transact(manager,ops=>ops.store.list('agentdecision',manager.tenantId).filter(item=>item.jobId===next.id).length),0);
 });
}
