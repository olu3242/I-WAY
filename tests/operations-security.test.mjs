import test from 'node:test';import assert from 'node:assert/strict';import{fixture}from'./helpers/operations-fixture.mjs';import{createOperationsFeatures}from'../domain/operations-features.mjs';
function withdraw(f,a,p){const current=f.store.principal(a.id);f.store.db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...current,permissions:current.permissions.filter(x=>x!==p)}),a.id)}
test('all load-bound replay receipts require current load visibility in addition to feature permission',async t=>{
 const f=await fixture(t,createOperationsFeatures()),l=f.createLoad(),p={category:'fuel',amountCents:100,basis:'recorded',reference:'ILL-REPLAY-SECURITY'};
 f.command(f.manager,'cost:record',l,p,'security-replay-cost');withdraw(f,f.manager,'load:view');
 assert.throws(()=>f.command(f.manager,'cost:record',l,p,'security-replay-cost'),e=>e.code==='FORBIDDEN');
 assert.equal(f.store.list('operationcost',f.manager.tenantId).length,1);
});
test('governance receipt cannot return protected policy after the requester loses governance access',async t=>{
 const f=await fixture(t,createOperationsFeatures()),p={enabled:true,disabledTools:[],reason:'Illustrative approved policy'};
 f.command(f.manager,'governance:update',null,p,'security-replay-governance');withdraw(f,f.manager,'governance:manage');
 assert.throws(()=>f.command(f.manager,'governance:update',null,p,'security-replay-governance'),e=>e.code==='FORBIDDEN');
 assert.deepEqual(f.ops.state(f.manager.id).governancepolicies,[]);
});