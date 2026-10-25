import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementMath} from '../domain/operations-settlements.mjs';
import {settlementFixture,terms} from './helpers/settlement-fixture.mjs';
import {projectResult} from '../domain/operations-projection.mjs';
const reason={reason:'Illustrative human-reviewed financial decision'};
const code=c=>e=>e.code===c;
test('PRD settlement example uses integer cents, explicit rounding, weekly deductions and target-bound escrow',()=>{
 const calc=settlementMath({...terms,grossRevenueCents:1800000,escrowRemainingCents:100000});assert.equal(calc.netCents,1215000);assert.equal(calc.adminFeeCents,180000);assert.equal(calc.deductionCents,375000);
 assert.equal(settlementMath({...terms,grossRevenueCents:1800000,escrowRemainingCents:7000}).escrowCents,7000);
 assert.equal(settlementMath({...terms,grossRevenueCents:1,shareBps:5000,adminFeeBps:0,deductions:[],escrowRemainingCents:0}).grossPayCents,1);
 for(const patch of [{roundingPolicy:undefined},{deductions:[{code:'fee',amountCents:1},{code:'fee',amountCents:2}]},{shareBps:10001},{grossRevenueCents:1.1},{adjustmentCents:-99999999}])assert.throws(()=>settlementMath({...terms,grossRevenueCents:1800000,escrowRemainingCents:0,...patch}));
});
test('weekly settlement source is first confirmed pickup in carrier time zone, not delivery date; duplicate payee/week denied',async t=>{
 const f=await settlementFixture(t),load=f.complete();let row=f.prepare();assert.equal(row.week,'2026-11-02');assert.equal(row.sourceLoads[0].id,load.id);assert.equal(row.calculation.netCents,1215000);const invoice=f.command(f.manager,'finance:prepare',load);assert.equal(invoice.payWeek,row.week);
 assert.throws(()=>f.prepare());assert.throws(()=>f.prepare({week:'2026-11-03'}),code('WEEK'));assert.throws(()=>f.prepare({week:'2026-11-09'}),code('SETTLEMENT_LOADS'));
 const safe=projectResult(f.ops,f.driver,{...row,status:'approved'});assert.equal(safe.netCents,1215000);assert.equal(safe.terms,undefined);assert.equal(safe.sourceLoads,undefined);assert.equal(safe.calculation,undefined);
});
test('approval is immutable, audited, replay-safe and reopen requires an explicit reason',async t=>{
 const f=await settlementFixture(t);f.complete();let row=f.prepare();const approved=f.command(f.manager,'settlement:approve',row,reason,'ILL-APPROVAL-REPLAY');assert.equal(approved.status,'approved');assert.deepEqual(f.command(f.manager,'settlement:approve',row,reason,'ILL-APPROVAL-REPLAY'),approved);
 assert.equal(f.store.list('settlementapproval',row.tenantId).length,1);
 for(const patch of [{calculation:{netCents:0}},{status:'draft',termsReason:'silent replacement'},{status:'approved'}])assert.throws(()=>f.store.update('settlement',row.id,row.tenantId,approved.version,patch),/immutable/);
 assert.throws(()=>f.store.db.prepare("DELETE FROM resources WHERE id=?").run(row.id),/cannot be deleted/);
 assert.throws(()=>f.command(f.manager,'settlement:unapprove',approved,{reason:''}));
 row=f.command(f.manager,'settlement:unapprove',approved,reason);assert.equal(row.status,'draft');
 row=f.command(f.manager,'settlement:adjust',row,{amountCents:-500,reason:reason.reason});assert.equal(row.calculation.netCents,1214500);
 assert.ok(f.store.db.prepare("SELECT action FROM audit WHERE outcome='success' AND resource_id=?").all(row.id).some(a=>a.action==='settlement:unapprove'));
});
test('approval rejects changed sources; approved escrow never exceeds the explicit target across weeks',async t=>{
 const f=await settlementFixture(t);const load=f.complete();let a=f.prepare({escrowTargetCents:40000});
 f.store.update('load',load.id,load.tenantId,load.version,{rateCents:1800100});
 assert.throws(()=>f.command(f.manager,'settlement:approve',a,reason),code('STALE'));a=f.command(f.manager,'settlement:recalculate',a);a=f.command(f.manager,'settlement:approve',a,reason);
 f.complete({stops:load.stops.map(s=>({...s,completedAt:null,at:s.type==='pickup'?'2026-11-09T14:00:00.000Z':'2026-11-10T16:00:00.000Z'}))});
 const b=f.prepare({week:'2026-11-09',escrowTargetCents:40000});assert.equal(b.calculation.escrowCents,10000);f.command(f.manager,'settlement:approve',b,reason);
 f.complete({stops:load.stops.map(s=>({...s,completedAt:null,at:s.type==='pickup'?'2026-11-16T14:00:00.000Z':'2026-11-17T16:00:00.000Z'}))});const c=f.prepare({week:'2026-11-16',escrowTargetCents:40000});assert.equal(c.calculation.escrowCents,0);
});
test('fleet owns driver pay; source dependency, immutable approval, dispute sidecar and driver projection enforced',async t=>{
 const f=await settlementFixture(t,{fleet:true});f.complete();let settlement=f.prepare();settlement=f.command(f.manager,'settlement:approve',settlement,reason);
 const dispute=f.command(f.fleetUser,'settlement:dispute',settlement,reason);assert.equal(dispute.status,'open');assert.equal(f.store.get('settlement',settlement.id,settlement.tenantId).version,settlement.version);
 const payload={driverId:f.driver.id,settlementId:settlement.id,perLoadCents:100000,reason:reason.reason};
 assert.throws(()=>f.command(f.manager,'driverpay:create',null,payload),code('FORBIDDEN'));
 let pay=f.command(f.fleetUser,'driverpay:create',null,payload);pay=f.command(f.fleetUser,'driverpay:approve',pay,reason);
 const safe=projectResult(f.ops,f.driver,pay);assert.equal(safe.netCents,100000);assert.equal(safe.sourceSettlementId,undefined);
 assert.throws(()=>projectResult(f.ops,f.driver,settlement),code('FORBIDDEN'));
 assert.throws(()=>f.command(f.manager,'settlement:unapprove',settlement,reason),code('PAYROLL_DEPENDENCY'));
 assert.throws(()=>f.store.update('driverpay',pay.id,pay.tenantId,pay.version,{netCents:1}),/immutable/);
 pay=f.command(f.fleetUser,'driverpay:unapprove',pay,reason);f.command(f.manager,'settlement:unapprove',settlement,reason);
 assert.throws(()=>f.command(f.fleetUser,'driverpay:approve',pay,reason),code('STALE'));
});
test('tenant, employment, role and recipient boundaries are checked before financial mutation',async t=>{
 const f=await settlementFixture(t,{fleet:true});f.complete();const row=f.prepare();
 for(const actor of [f.driver,f.fleetUser,f.outsider])assert.throws(()=>f.command(actor,'settlement:approve',row,reason));
 const source=f.command(f.manager,'settlement:approve',row,reason);
 const pay=f.command(f.fleetUser,'driverpay:create',null,{driverId:f.driver.id,settlementId:source.id,perLoadCents:1,reason:reason.reason});
 const driver=f.store.get('driver',f.driver.id,f.manager.tenantId);f.store.update('driver',driver.id,driver.tenantId,driver.version,{active:false});
 assert.throws(()=>f.command(f.fleetUser,'driverpay:approve',pay,reason),code('PAYEE'));
 assert.equal(f.store.get('driverpay',pay.id,pay.tenantId).status,'draft');
});
