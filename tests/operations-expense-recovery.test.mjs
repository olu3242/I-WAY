import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {settlementFixture} from './helpers/settlement-fixture.mjs';
import {OperationsStore} from '../server/operations-store.mjs';
import {Operations} from '../domain/operations.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
import {backupOperations,restoreOperations} from '../server/operations-recovery.mjs';
const data=load=>({loadId:load.id,category:'toll',amountCents:2500,incurredAt:'2026-01-01T12:00:00Z',evidenceReference:'ILL RECOVERY',note:'Illustrative reimbursement'});
test('expense audit failure rolls back the decision and permits safe same-key recovery',async t=>{
 const f=await settlementFixture(t),load=f.complete(),row=f.command(f.driver,'expense:submit',null,data(load)),key=randomUUID();
 f.store.db.exec("CREATE TRIGGER illustrative_expense_failure BEFORE INSERT ON audit WHEN NEW.action='expense:review' AND NEW.outcome='success' BEGIN SELECT RAISE(ABORT,'Illustrative audit failure'); END");
 assert.throws(()=>f.command(f.manager,'expense:review',row,{decision:'approve',reason:'Illustrative reviewed evidence'},key));assert.equal(f.store.get('expense',row.id,row.tenantId).status,'submitted');assert.equal(f.ops.state(f.driver.id).expenseHistory.length,1);
 f.store.db.exec('DROP TRIGGER illustrative_expense_failure');assert.equal(f.command(f.manager,'expense:review',row,{decision:'approve',reason:'Illustrative reviewed evidence'},key).status,'approved');assert.equal(f.ops.state(f.driver.id).expenseHistory.length,2);
});
test('snapshot restore retains approved reimbursement, immutable receipt and audit without duplication',async t=>{
 const f=await settlementFixture(t),load=f.complete();let row=f.command(f.driver,'expense:submit',null,data(load));row=f.command(f.manager,'expense:review',row,{decision:'approve',reason:'Illustrative employer approval'});let pay=f.prepare();pay=f.command(f.manager,'settlement:approve',pay,{reason:'Illustrative financial review'});
 const backup=await backupOperations({sourcePath:f.path,backupDirectory:join(f.root,'expense-backup')});const restored=await restoreOperations({backupDirectory:join(f.root,'expense-backup'),targetDirectory:join(f.root,'expense-restored'),expectedManifestSha256:backup.manifestSha256});assert.equal(restored.integrity,'ok');
 const store=new OperationsStore(join(f.root,'expense-restored','operations.sqlite'));try{const ops=new Operations(store,createOperationsFeatures()),state=ops.state(f.driver.id);assert.equal(state.expenses[0].id,row.id);assert.equal(state.expenseHistory.length,2);assert.equal(state.expenses[0].reimbursement.records.length,1);assert.equal(state.expenses[0].reimbursement.payment,'not_verified');assert.equal(state.settlements[0].reimbursementCents,2500);assert.throws(()=>store.update('expense',row.id,row.tenantId,row.version,{amountCents:1}));assert.throws(()=>ops.execute(f.driver.id,{action:'expense:submit',payload:data(load),idempotencyKey:randomUUID()}));assert.equal(store.list('expense',row.tenantId).length,1);}finally{store.close();}
});
