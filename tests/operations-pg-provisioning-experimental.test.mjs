import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgProvisioner} from '../server/operations-pg-provisioning.experimental.mjs';
const id='11111111-1111-4111-8111-111111111111';
const request={invitationId:id,tenantId:id,actorId:id,issuer:'fixture',subjectHash:'a'.repeat(64),role:'driver',proofHash:'b'.repeat(64)};
test('rejects unauthorized role before opening transaction',async()=>{
 let invoked=false;const repo=createPgProvisioner(async()=>{invoked=true});
 await assert.rejects(repo.provision({...request,role:'superadmin'}),/INVALID_PROVISIONING_REQUEST/);
 assert.equal(invoked,false);
});
test('account, binding, activation and audit share restricted transaction',async()=>{
 const sql=[];
 const repo=createPgProvisioner(async fn=>fn({query:async(q)=>{
  sql.push(q);
  if(q.includes('RETURNING id')&&q.includes('provisioned_accounts'))return {rowCount:1,rows:[{id}]};
  return {rowCount:1,rows:[{id}]};
 }}));
 const result=await repo.provision(request);
 assert.equal(result.state,'ACTIVE');
 assert.equal(sql.length,6);
 assert.match(sql[0],/identity_proof_uses/);assert.match(sql[1],/state='VERIFIED'/);
 assert.match(sql[1],/assignment->>'role'/);
 assert.match(sql[3],/tenant_role_bindings/);
 assert.match(sql[5],/invitation_events/);
});
test('mismatched identity prevents account creation',async()=>{
 let calls=0;
 const repo=createPgProvisioner(async fn=>fn({query:async()=>{
  calls++;return {rowCount:0,rows:[]};
 }}));
 await assert.rejects(repo.provision(request),/PROVISIONING_REJECTED/);
 assert.equal(calls,2);
});
test('binding failure propagates for transaction rollback',async()=>{
 const repo=createPgProvisioner(async fn=>fn({query:async sql=>{
  if(sql.includes('tenant_role_bindings'))throw Error('BINDING_FAILED');
  return {rowCount:1,rows:[{id}]};
 }}));
 await assert.rejects(repo.provision(request),/BINDING_FAILED/);
});
