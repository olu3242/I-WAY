import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {settlementFixture} from './helpers/settlement-fixture.mjs';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {addUser} from '../server/operations-auth.mjs';
import {expenseProjection,assertExpenseAllocationAvailable} from '../domain/operations-expenses.mjs';
const reason='Illustrative independent expense review';
export const expenseData=load=>({loadId:load.id,category:'toll',amountCents:2500,incurredAt:'2026-01-01T12:00:00Z',evidenceReference:'ILL EXPENSE 1',note:'Illustrative toll receipt'});
test('driver draft, correction, information return, resubmission and approval retain one ID and durable history',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign();let row=f.command(f.driver,'expense:draft',null,expenseData(load));const id=row.id;assert.equal(row.status,'draft');assert.equal(row.currency,'USD');assert.ok(row.createdAt.endsWith('Z'));
 row=f.command(f.driver,'expense:update',row,{data:{...expenseData(load),amountCents:3000},reason:'Illustrative draft correction'});row=f.command(f.driver,'expense:resubmit',row,{});row=f.command(f.manager,'expense:review',row,{decision:'needs_information',reason:'Illustrative missing receipt detail'});assert.equal(row.status,'needs_information');
 row=f.command(f.driver,'expense:update',row,{data:{...expenseData(load),amountCents:3500},reason:'Illustrative clarified receipt'});row=f.command(f.driver,'expense:resubmit',row,{});row=f.command(f.manager,'expense:review',row,{decision:'approve',reason});assert.equal(row.id,id);assert.equal(row.amountCents,3500);
 const second=new OperationsStore(f.path);try{const state=new Operations(second,createOperationsFeatures()).state(f.driver.id);assert.equal(state.expenses[0].status,'approved');assert.equal(state.expenseHistory.length,7);assert.ok(state.expenseHistory.some(h=>h.reason==='Illustrative missing receipt detail'));assert.equal(state.expenses[0].reimbursement.state,'awaiting_approved_statement');assert.equal(state.expenses[0].reimbursement.payment,'not_verified');}finally{second.close();}
});
test('invalid amounts, categories, future dates, sensitive-pointer shapes and forged ownership are rejected',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign(),p=expenseData(load);
 for(const amountCents of [0,-1,1.5,100000001,Number.MAX_SAFE_INTEGER,NaN])assert.throws(()=>f.command(f.driver,'expense:submit',null,{...p,amountCents}));
 for(const evidenceReference of ['https://illustrative.invalid/file','../file','C:\\receipt','person@illustrative.invalid','', 'x'.repeat(121)])assert.throws(()=>f.command(f.driver,'expense:submit',null,{...p,evidenceReference}));
 for(const patch of [{category:'unsupported'},{incurredAt:'2099-01-01T00:00:00Z'},{incurredAt:'invalid'},{incurredAt:'2026-02-30T12:00:00Z'},{incurredAt:'2026-01-01T24:00:00Z'},{driverId:f.outsider.id},{fleetId:f.fleet.id},{status:'approved'},{currency:'EUR'},{amountCents:'2500'}])assert.throws(()=>f.command(f.driver,'expense:submit',null,{...p,...patch}));
 assert.equal(f.store.list('expense',f.manager.tenantId).length,0);
});
test('active receipts are reserved across drafts and returned records; same-key replay creates once',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign(),p=expenseData(load),key=randomUUID();let row=f.command(f.driver,'expense:draft',null,p,key);assert.equal(f.command(f.driver,'expense:draft',null,p,key).id,row.id);assert.throws(()=>f.command(f.driver,'expense:draft',null,{...p,amountCents:10},key),e=>e.code==='IDEMPOTENCY');
 for(const action of ['expense:draft','expense:submit'])assert.throws(()=>f.command(f.driver,action,null,{...p,evidenceReference:'  ill expense 1  '}),e=>e.code==='EXPENSE_DUPLICATE');row=f.command(f.driver,'expense:resubmit',row,{});row=f.command(f.manager,'expense:review',row,{decision:'needs_information',reason});assert.throws(()=>f.command(f.driver,'expense:submit',null,p));assert.equal(f.store.list('expense',f.manager.tenantId).length,1);
});
test('expense owner, tenant and employer projection boundaries deny impersonation and foreign financial data',async t=>{
 const f=await settlementFixture(t,{fleet:true}),load=f.complete(),row=f.command(f.driver,'expense:submit',null,expenseData(load));const peer=addUser(f.store,{tenantId:f.manager.tenantId,role:'driver',name:'Illustrative peer',username:'peer@illustrative.invalid',password:'illustrative-fixture-only-47'});
 for(const actor of [f.manager,f.outsider,f.dispatcher,peer]){assert.throws(()=>expenseProjection(f.ops,actor,row));assert.equal(f.ops.state(actor.id).expenses.length,0);assert.equal(f.ops.state(actor.id).expenseHistory.length,0);assert.throws(()=>f.command(actor,'expense:review',row,{decision:'approve',reason}));}
 assert.throws(()=>f.command(f.fleetUser,'expense:submit',null,expenseData(load)));assert.equal(f.ops.state(f.fleetUser.id).expenses.length,1);
});
test('submitted and final records cannot be corrected; review and withdrawal need reasons and current versions',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign(),p=expenseData(load);let row=f.command(f.driver,'expense:submit',null,p);
 assert.throws(()=>f.command(f.driver,'expense:update',row,{data:p,reason}));assert.throws(()=>f.command(f.manager,'expense:review',row,{decision:'approve',reason:''}));const old=row;row=f.command(f.manager,'expense:review',row,{decision:'needs_information',reason});assert.throws(()=>f.command(f.driver,'expense:update',old,{data:p,reason}),e=>e.code==='STALE');
 row=f.command(f.driver,'expense:withdraw',row,{reason});assert.throws(()=>f.command(f.driver,'expense:update',row,{data:p,reason}));assert.throws(()=>f.command(f.driver,'expense:resubmit',row,{}));assert.throws(()=>f.command(f.manager,'expense:review',row,{decision:'approve',reason}));
});
test('immutable expense identity and approved values resist direct updates and deletion',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign();let row=f.command(f.driver,'expense:draft',null,expenseData(load));for(const patch of [{driverId:f.outsider.id},{fleetId:f.fleet.id},{loadId:randomUUID()},{currency:'EUR'},{createdAt:'2000-01-01T00:00:00Z'}])assert.throws(()=>f.store.update('expense',row.id,row.tenantId,row.version,patch));row=f.command(f.driver,'expense:resubmit',row,{});row=f.command(f.manager,'expense:review',row,{decision:'approve',reason});assert.throws(()=>f.store.update('expense',row.id,row.tenantId,row.version,{amountCents:1}));assert.throws(()=>f.store.db.prepare("DELETE FROM resources WHERE kind='expense' AND id=?").run(row.id));
});
test('changed employment or assignment blocks review and prevents automatic expense transfer',async t=>{
 const f=await fixture(t,createOperationsFeatures()),load=f.assign();const row=f.command(f.driver,'expense:submit',null,expenseData(load));const driver=f.store.get('driver',f.driver.id,f.manager.tenantId);f.store.update('driver',driver.id,driver.tenantId,driver.version,{fleetId:f.fleet.id});assert.throws(()=>f.command(f.manager,'expense:review',row,{decision:'approve',reason}),e=>e.code==='EXPENSE_RELATIONSHIP');assert.equal(f.store.get('expense',row.id,row.tenantId).fleetId,null);
});
test('carrier reimbursement includes once, survives reopening, and never claims transferred funds',async t=>{
 const f=await settlementFixture(t),load=f.complete();let row=f.command(f.driver,'expense:submit',null,expenseData(load));row=f.command(f.manager,'expense:review',row,{decision:'approve',reason});let pay=f.prepare();assert.equal(pay.calculation.reimbursementCents,2500);pay=f.command(f.manager,'settlement:approve',pay,{reason});let state=f.ops.state(f.driver.id);assert.equal(state.expenses[0].reimbursement.state,'included_in_approved_statement');assert.equal(state.expenses[0].reimbursement.records.length,1);assert.equal(state.expenses[0].reimbursement.payment,'not_verified');pay=f.command(f.manager,'settlement:unapprove',pay,{reason});assert.equal(f.ops.state(f.driver.id).expenses[0].reimbursement.state,'awaiting_approved_statement');pay=f.command(f.manager,'settlement:approve',pay,{reason});assert.equal(pay.calculation.reimbursementCents,2500);
 assert.throws(()=>assertExpenseAllocationAvailable(f.ops,{...pay,id:randomUUID()}),e=>e.code==='EXPENSE_ALLOCATED');assert.throws(()=>assertExpenseAllocationAvailable(f.ops,{...pay,id:randomUUID(),expenseSources:[...pay.expenseSources,...pay.expenseSources]}),e=>e.code==='EXPENSE_ALLOCATION');
});
test('fleet reimbursement enters only fleet driver pay; late approvals require an explicit reviewed revision',async t=>{
 const f=await settlementFixture(t,{fleet:true}),load=f.complete();let source=f.prepare();source=f.command(f.manager,'settlement:approve',source,{reason});let pay=f.command(f.fleetUser,'driverpay:create',null,{driverId:f.driver.id,settlementId:source.id,model:'salary',terms:{weeklyCents:10000},reason});pay=f.command(f.fleetUser,'driverpay:approve',pay,{reason});let row=f.command(f.driver,'expense:submit',null,expenseData(load));row=f.command(f.fleetUser,'expense:review',row,{decision:'approve',reason});assert.equal(f.ops.state(f.driver.id).expenses[0].reimbursement.state,'awaiting_approved_statement');assert.equal(f.store.get('driverpay',pay.id,pay.tenantId).netCents,10000);
 pay=f.command(f.fleetUser,'driverpay:unapprove',pay,{reason});pay=f.command(f.fleetUser,'driverpay:revise',pay,{driverId:f.driver.id,settlementId:source.id,model:'salary',terms:{weeklyCents:10000},reason});pay=f.command(f.fleetUser,'driverpay:approve',pay,{reason});assert.equal(pay.netCents,12500);assert.equal(source.calculation.reimbursementCents,0);assert.equal(f.ops.state(f.driver.id).expenses[0].reimbursement.records[0].kind,'driverpay');assert.equal(f.ops.state(f.manager.id).expenses.length,0);
});
test('legacy expense metadata remains reviewable without rewriting original ownership or inventing audit events',async t=>{
 const f=await settlementFixture(t),load=f.complete();const row=f.store.insert('expense',f.manager.tenantId,{...expenseData(load),driverId:f.driver.id,fleetId:null,status:'submitted',submittedAt:'2026-01-01T12:00:00Z'});const approved=f.command(f.manager,'expense:review',row,{decision:'approve',reason});assert.equal(approved.currency,'USD');const stored=f.store.get('expense',row.id,row.tenantId);assert.equal(stored.currency,undefined);assert.equal(stored.createdAt,undefined);assert.equal(f.ops.state(f.driver.id).expenseHistory.length,1);let pay=f.prepare();pay=f.command(f.manager,'settlement:approve',pay,{reason});assert.equal(pay.calculation.reimbursementCents,2500);
});
