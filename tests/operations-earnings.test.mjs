import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementFixture} from './helpers/settlement-fixture.mjs';
import {authorizedPdf} from '../server/operations-pdf.mjs';
test('earnings period summaries use approved own pay-week rows and protect PDF identity',async t=>{
 const f=await settlementFixture(t);f.complete();const draft=f.prepare();assert.equal(f.ops.state(f.driver.id).earningsPeriods.all_time.netCents,0);f.command(f.manager,'settlement:approve',draft,{reason:'Illustrative earnings review'});const periods=f.ops.state(f.driver.id).earningsPeriods;assert.equal(periods.current_week.netCents,1215000);assert.equal(periods.last_week.netCents,0);assert.equal(periods.annual_2026.netCents,1215000);assert.equal(periods.year_to_date.netCents,1215000);assert.equal(periods.last_month.netCents,0);assert.ok(authorizedPdf(f.ops,f.driver,{type:'earnings',id:f.driver.id,period:'year_to_date'}).bytes.length>1000);assert.throws(()=>authorizedPdf(f.ops,f.driver,{type:'earnings',id:f.outsider.id}));assert.throws(()=>authorizedPdf(f.ops,f.manager,{type:'earnings',id:f.manager.id}));assert.throws(()=>authorizedPdf(f.ops,f.driver,{type:'earnings',id:f.driver.id,period:'unavailable'}));
});
