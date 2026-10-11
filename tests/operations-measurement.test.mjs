import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';import {createOperationsFeatures} from '../domain/operations-features.mjs';
test('measurement uses immutable reported evidence and separates actual costs, estimates and unavailable causal ROI',async t=>{
 let now=new Date('2026-11-02T14:00:00Z');const f=await fixture(t,{...createOperationsFeatures(),now:()=>now});let l=f.assign();
 const route=f.command(f.dispatcher,'route:evaluate',l,{source:'user_estimate',distanceMiles:100,averageMph:50,handlingMinutes:0,departureAt:now.toISOString()});
 l=f.command(f.driver,'load:accept',l);l=f.command(f.driver,'load:pickup',l,{stopId:l.stops[0].id});l=f.command(f.driver,'load:transit',l);now=new Date('2026-11-02T16:00:00Z');
 l=f.command(f.driver,'load:deliver',l,{stopId:l.stops[1].id,proofReference:'ILL-MEASUREMENT'});
 f.command(f.manager,'cost:record',l,{category:'fuel',amountCents:11000,basis:'recorded',reference:'ILL-ACTUAL'});
 f.command(f.manager,'cost:record',l,{category:'fuel',amountCents:12000,basis:'estimate',reference:'ILL-ESTIMATE'});
 const p={actualMiles:110,reference:'ILL-ODOMETER',observedAt:now.toISOString(),routeId:route.id},m=f.command(f.manager,'measurement:record',l,p,'measurement-idempotent');
 assert.deepEqual(f.command(f.manager,'measurement:record',l,p,'measurement-idempotent'),m);
 const view=f.ops.state(f.manager.id).operationalMetrics;
 assert.equal(view.costs.recordedCents,11000);assert.equal(view.costs.estimatedCents,12000);assert.equal(view.distance[0].varianceMiles,10);assert.equal(view.distance[0].costPerReportedMileCents,100);
 assert.equal(view.cycleTime.value,2);assert.equal(view.roi.savingsCents,null);assert.equal(view.recommendations.acceptance.value,null);assert.equal(view.recommendations.causalImpact,null);
 assert.throws(()=>f.command(f.manager,'measurement:record',l,p),e=>e.code==='MEASUREMENT_EXISTS');
 assert.throws(()=>f.store.update('measurement',m.id,f.manager.tenantId,m.version,{actualMiles:1}),/immutable/);
 assert.equal(f.ops.state(f.dispatcher.id).operationalMetrics.costs,null);assert.deepEqual(f.ops.state(f.dispatcher.id).operationalMetrics.distance,[]);
 assert.equal(f.ops.state(f.driver.id).operationalMetrics,null);assert.equal(f.ops.state(f.outsider.id).operationalMetrics.costs.costPerMeasuredLoad.value,null);
});
test('measurement cannot record unfinished, nonfinite, future or unauthorized evidence',async t=>{
 const f=await fixture(t,createOperationsFeatures()),l=f.assign(),p={actualMiles:100,reference:'ILL-INPUT',observedAt:new Date().toISOString()};
 assert.throws(()=>f.command(f.manager,'measurement:record',l,p),e=>e.code==='MEASUREMENT_STATE');
 assert.throws(()=>f.command(f.dispatcher,'measurement:record',l,p),e=>e.code==='FORBIDDEN');
 assert.throws(()=>f.command(f.outsider,'measurement:record',l,p),e=>e.code==='NOT_FOUND');
 let a=f.command(f.driver,'load:accept',l);a=f.command(f.driver,'load:pickup',a,{stopId:a.stops[0].id});a=f.command(f.driver,'load:transit',a);a=f.command(f.driver,'load:deliver',a,{stopId:a.stops[1].id,proofReference:'ILL-PROOF'});
 for(const patch of [{actualMiles:Infinity},{actualMiles:0},{actualMiles:-1},{observedAt:'2099-01-01T00:00:00Z'},{reference:'personal data is not an identifier'}])assert.throws(()=>f.command(f.manager,'measurement:record',a,{...p,observedAt:a.deliveredAt,...patch}));
});
