import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgProvisioner} from '../server/operations-pg-provisioning.experimental.mjs';
const id='11111111-1111-4111-8111-111111111111';
const request={invitationId:id,tenantId:id,actorId:id,issuer:'fixture',subjectHash:'a'.repeat(64),role:'driver',proofHash:'b'.repeat(64),nonce:'fixture-nonce'};
test('rejects unauthorized role before opening transaction',async()=>{
 let invoked=false;const repo=createPgProvisioner(async()=>{invoked=true},{consumeNonce:async()=>{}});
 await assert.rejects(repo.provision({...request,role:'superadmin'}),/INVALID_PROVISIONING_REQUEST/);
 assert.equal(invoked,false);
});
test('account, binding, activation and audit share restricted transaction',async()=>{
 const sql=[];
 const repo=createPgProvisioner(async fn=>fn({query:async(q)=>{
  sql.push(q);
  if(q.includes('RETURNING id')&&q.includes('provisioned_accounts'))return {rowCount:1,rows:[{id}]};
  return {rowCount:1,rows:[{id}]};
 }}),{consumeNonce:async()=>{}});
 const result=await repo.provision(request);
 assert.equal(result.state,'ACTIVE');
 assert.equal(sql.length,7);
 assert.match(sql[0],/identity_proof_uses/);assert.match(sql[1],/state='VERIFIED'/);
 assert.match(sql[1],/assignment->>'role'/);
 assert.match(sql[3],/tenant_role_bindings/);
 assert.match(sql[5],/invitation_events/);
 assert.match(sql[6],/nonce_cleanup_jobs/);
});
test('mismatched identity prevents account creation',async()=>{
 let calls=0;
 const repo=createPgProvisioner(async fn=>fn({query:async()=>{
  calls++;return {rowCount:0,rows:[]};
 }}),{consumeNonce:async()=>{}});
 await assert.rejects(repo.provision(request),/PROVISIONING_REJECTED/);
 assert.equal(calls,2);
});
test('binding failure propagates for transaction rollback',async()=>{
 const repo=createPgProvisioner(async fn=>fn({query:async sql=>{
  if(sql.includes('tenant_role_bindings'))throw Error('BINDING_FAILED');
  return {rowCount:1,rows:[{id}]};
 }}),{consumeNonce:async()=>{}});
 await assert.rejects(repo.provision(request),/BINDING_FAILED/);
});

test('activation update with zero affected rows fails closed',async()=>{
 const repo=createPgProvisioner(async fn=>fn({query:async sql=>{
  if(sql.includes("SET user_id=$2,state='ACTIVE'"))return {rowCount:0,rows:[]};
  return {rowCount:1,rows:[{id}]};
 }}),{consumeNonce:async()=>{}});
 await assert.rejects(repo.provision(request),/ACTIVATION_REJECTED/);
});

test('nonce consumption failure blocks all provisioning writes',async()=>{
 let queries=0;
 const repo=createPgProvisioner(async fn=>fn({query:async()=>{queries++;return {rowCount:1,rows:[{id}]}}}),
  {consumeNonce:async()=>{throw Error('NONCE_CONSUMPTION_REJECTED')}});
 await assert.rejects(repo.provision(request),/NONCE_CONSUMPTION_REJECTED/);
 assert.equal(queries,0);
});

test('cleanup job insertion failure aborts activation transaction',async()=>{
 const repo=createPgProvisioner(async fn=>fn({query:async sql=>{
  if(sql.includes('nonce_cleanup_jobs'))throw Error('CLEANUP_JOB_INSERT_FAILED');
  return {rowCount:1,rows:[{id}]};
 }}),{consumeNonce:async()=>{}});
 await assert.rejects(repo.provision(request),/CLEANUP_JOB_INSERT_FAILED/);
});
