import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {validateConfiguredRecord} from '../domain/operations-admin-validation.mjs';
test('tenant validation rules enforce required fields and never affect another tenant',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE organization_admin(tenant_id TEXT,kind TEXT,id TEXT,data TEXT)');
 db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?)').run('a','validation-rule','requireCustomer',JSON.stringify({name:'requireCustomer',object:'load',field:'customerId',operator:'required',enabled:true}));
 const store={db};
 assert.deepEqual(validateConfiguredRecord(store,'a','load',{customerId:'C'}),{valid:true});
 assert.deepEqual(validateConfiguredRecord(store,'a','load',{customerId:''}),{valid:false,code:'VALIDATION_RULE',ruleId:'requireCustomer'});
 assert.deepEqual(validateConfiguredRecord(store,'b','load',{customerId:''}),{valid:true});
 assert.deepEqual(validateConfiguredRecord(store,'a','vehicle',{}),{valid:true});
});
test('invalid active rule fails closed',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE organization_admin(tenant_id TEXT,kind TEXT,id TEXT,data TEXT)');
 db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?)').run('a','validation-rule','broken',JSON.stringify({object:'load',field:'x',operator:'javascript'}));
 assert.equal(validateConfiguredRecord({db},'a','load',{}).code,'INVALID_RULE');
});

test('retained deactivated rules do not block new records',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE organization_admin(tenant_id TEXT,kind TEXT,id TEXT,data TEXT)');
 db.prepare('INSERT INTO organization_admin VALUES(?,?,?,?)').run('a','validation-rule','retained',JSON.stringify({name:'retained',object:'load',field:'customerId',operator:'required',enabled:true,_deactivated:true}));
 assert.deepEqual(validateConfiguredRecord({db},'a','load',{}),{valid:true});db.close();
});
