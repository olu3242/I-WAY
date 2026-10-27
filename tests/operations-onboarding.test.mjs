import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/operations-fixture.mjs';
import {createOperationsFeatures} from '../domain/operations-features.mjs';
const reason='Illustrative independent review';
test('onboarding gates block dispatch through information recovery, independent review and separate operating approval',async t=>{
 const f=await fixture(t,createOperationsFeatures());let row=f.command(f.manager,'onboarding:start',null,{subjectKind:'driver',subjectId:f.driver.id,reason});const load=f.createLoad();assert.equal(f.ops.eligibility(f.manager,f.driver.id,f.vehicle.id,load).eligible,false);
 assert.throws(()=>f.command(f.driver,'onboarding:activate',row,{reason}));assert.throws(()=>f.command(f.driver,'onboarding:submit',row,{}));
 row=f.command(f.driver,'onboarding:save',row,{profile:{displayName:'Illustrative Driver',timezone:'America/Chicago',agreementReference:'ILL agreement'}});row=f.command(f.driver,'onboarding:submit',row,{});assert.throws(()=>f.command(f.driver,'onboarding:review',row,{decision:'approved',reason,verificationReference:'ILL review'}));
 row=f.command(f.manager,'onboarding:review',row,{decision:'needs_information',reason});row=f.command(f.driver,'onboarding:save',row,{profile:{displayName:'Illustrative corrected profile',timezone:'America/Chicago',agreementReference:'ILL corrected agreement'}});row=f.command(f.driver,'onboarding:submit',row,{});row=f.command(f.manager,'onboarding:review',row,{decision:'approved',reason,verificationReference:'ILL external verification'});row=f.command(f.manager,'onboarding:activate',row,{reason});assert.equal(row.status,'active');assert.equal(f.ops.eligibility(f.manager,f.driver.id,f.vehicle.id,load).eligible,true);
 assert.throws(()=>f.command(f.driver,'onboarding:save',row,{profile:{displayName:'Denied',timezone:'UTC',agreementReference:'Denied'}}));assert.equal(f.ops.state(f.outsider.id).onboardings.length,0);
});
test('fleet onboarding cannot approve employment for carrier operations; active assignments and sensitive fields are denied',async t=>{
 const f=await fixture(t,createOperationsFeatures());f.assign();assert.throws(()=>f.command(f.manager,'onboarding:start',null,{subjectKind:'driver',subjectId:f.driver.id,reason}),e=>e.code==='ASSIGNMENT');
 const row=f.command(f.fleetUser,'onboarding:start',null,{subjectKind:'fleet',subjectId:f.fleet.id,reason});assert.throws(()=>f.command(f.fleetUser,'onboarding:review',row,{decision:'approved',reason,verificationReference:'ILL'}));assert.throws(()=>f.command(f.manager,'onboarding:save',row,{profile:{displayName:'Illustrative',timezone:'UTC',agreementReference:'ILL',ssn:'not-collected'}}),e=>e.code==='FIELDS');
});
