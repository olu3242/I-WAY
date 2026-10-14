import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_SECTIONS,validateOrganizationSettings,effectivePermission,canAccessField,projectAuthorizedFields,validateRuleDefinition,evaluateValidationRule} from '../domain/enterprise-admin.mjs';

const resource={tenantId:'carrier-a',kind:'load',id:'load-1'};
const carrier={id:'owner',tenantId:'carrier-a',role:'carrier',permissions:['load:view','load:dispatch','asset:view','asset:manage']};
const dispatcher={id:'dispatch',tenantId:'carrier-a',role:'dispatcher',permissions:['load:view','load:dispatch','asset:view']};
const driver={id:'driver-1',tenantId:'carrier-a',role:'driver',permissions:['load:view']};

test('administration section registry is stable and complete',()=>assert.ok(['company','users','permission-sets','field-security','validation-rules','audit'].every(x=>ADMIN_SECTIONS.includes(x))));
test('company settings validation enforces required legal name',()=>{
 assert.deepEqual(validateOrganizationSettings({legalName:'Northstar Logistics',timeZone:'America/Chicago',currency:'USD',dotNumber:'123456'}),{valid:true,errors:[]});
 assert.equal(validateOrganizationSettings({legalName:'',currency:'dollars'}).valid,false);
 assert.equal(validateOrganizationSettings(null).valid,false);
});
test('effective permissions never cross tenants or expand baseline authority',()=>{
 assert.equal(effectivePermission(carrier,'load:dispatch',resource),true);
 assert.equal(effectivePermission(carrier,'load:dispatch',{tenantId:'carrier-b'}),false);
 assert.equal(effectivePermission(driver,'load:dispatch',resource,{grants:['load:dispatch']}),false);
 assert.equal(effectivePermission(carrier,'load:dispatch',resource,{denials:['load:dispatch']}),false);
 assert.equal(effectivePermission(carrier,'load:dispatch',resource,{grants:['load:view']}),false);
});
test('field security denies unregistered fields and respects role restrictions',()=>{
 assert.equal(canAccessField({actor:carrier,resource,object:'load',field:'margin'}),true);
 assert.equal(canAccessField({actor:dispatcher,resource,object:'load',field:'margin'}),false);
 assert.equal(canAccessField({actor:driver,resource,object:'load',field:'carrierRate'}),false);
 assert.equal(canAccessField({actor:carrier,resource,object:'load',field:'unregistered'}),false);
 assert.equal(canAccessField({actor:carrier,resource:{tenantId:'carrier-b'},object:'load',field:'margin'}),false);
 assert.equal(canAccessField({actor:carrier,resource,object:'load',field:'margin',operation:'update'}),false);
});
test('field projections omit sensitive and unknown data rather than masking UI only',()=>{
 assert.deepEqual(projectAuthorizedFields({actor:dispatcher,resource,object:'load',record:{carrierRate:1500,margin:300,unknown:5}}),{});
 assert.deepEqual(projectAuthorizedFields({actor:carrier,resource,object:'load',record:{carrierRate:1500,margin:300,unknown:5}}),{carrierRate:1500,margin:300});
});
test('closed validation operators reject malformed rules and evaluate deterministic data',()=>{
 const required={id:'LOAD_CUSTOMER_REQUIRED',object:'load',field:'customerId',operator:'required',version:1,enabled:true};
 assert.equal(validateRuleDefinition(required),true);
 assert.deepEqual(evaluateValidationRule(required,{customerId:'ACME'}),{valid:true,code:'PASS'});
 assert.deepEqual(evaluateValidationRule(required,{customerId:''}),{valid:false,code:'LOAD_CUSTOMER_REQUIRED'});
 assert.deepEqual(evaluateValidationRule({...required,operator:'javascript'},{}),{valid:false,code:'INVALID_RULE'});
 assert.deepEqual(evaluateValidationRule({...required,operator:'min',value:1},{customerId:2}),{valid:true,code:'PASS'});
});
