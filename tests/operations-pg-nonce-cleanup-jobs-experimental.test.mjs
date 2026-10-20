import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgNonceCleanupJobs} from '../server/operations-pg-nonce-cleanup-jobs.experimental.mjs';
test('enqueues tenant-bound cleanup job',async()=>{
 let sql,params;
 const jobs=createPgNonceCleanupJobs(async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[]};});
 await jobs.enqueue({invitationId:'invite',tenantId:'tenant'});
 assert.match(sql,/ON CONFLICT\(invitation_id\)/);
 assert.match(sql,/WHERE operations_onboarding.nonce_cleanup_jobs.tenant_id=EXCLUDED.tenant_id/);
 assert.deepEqual(params,['invite','tenant']);
});
test('rejects cross-tenant duplicate job',async()=>{
 const jobs=createPgNonceCleanupJobs(async()=>({rowCount:0,rows:[]}));
 await assert.rejects(jobs.enqueue({invitationId:'invite',tenantId:'wrong'}),/TENANT_CONFLICT/);
});
test('fetches bounded pending jobs',async()=>{
 const jobs=createPgNonceCleanupJobs(async()=>({rows:[{invitation_id:'invite',tenant_id:'tenant'}]}));
 assert.deepEqual(await jobs.pending(),[{invitationId:'invite',tenantId:'tenant'}]);
 await assert.rejects(jobs.pending({limit:101}),/INVALID_NONCE_JOB_LIMIT/);
});
test('marks only pending matching tenant jobs complete',async()=>{
 const jobs=createPgNonceCleanupJobs(async(q,p)=>({rowCount:q.includes("state='PENDING'")&&p[1]==='tenant'?1:0,rows:[]}));
 assert.equal(await jobs.complete({invitationId:'invite',tenantId:'tenant',ownerId:'11111111-1111-4111-8111-111111111111'}),true);
 assert.equal(await jobs.complete({invitationId:'invite',tenantId:'wrong',ownerId:'11111111-1111-4111-8111-111111111111'}),false);
});

test('claim requires valid owner and bounded lease duration',async()=>{
 const jobs=createPgNonceCleanupJobs(async()=>{throw Error('unexpected query')});
 await assert.rejects(jobs.claim({ownerId:'invalid'}),/INVALID_NONCE_JOB_CLAIM/);
 await assert.rejects(jobs.claim({ownerId:'11111111-1111-4111-8111-111111111111',leaseSeconds:601}),/INVALID_NONCE_JOB_CLAIM/);
});
test('claim query excludes unexpired leases and uses SKIP LOCKED',async()=>{
 let sql,params;
 const jobs=createPgNonceCleanupJobs(async(q,p)=>{sql=q;params=p;return {rows:[]};});
 await jobs.claim({ownerId:'11111111-1111-4111-8111-111111111111',limit:2,leaseSeconds:30});
 assert.match(sql,/FOR UPDATE SKIP LOCKED/);
 assert.match(sql,/lease_until<now\(\)/);
 assert.deepEqual(params,[2,'11111111-1111-4111-8111-111111111111',30]);
});

test('B424 checks tenant-scoped live lease ownership',async()=>{
 let sql,params;
 const jobs=createPgNonceCleanupJobs(async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[{}]};});
 const ownerId='11111111-1111-4111-8111-111111111111';
 assert.equal(await jobs.ownsLease({invitationId:'invite',tenantId:'tenant',ownerId}),true);
 assert.match(sql,/lease_until>now\(\)/);
 assert.deepEqual(params,['invite','tenant',ownerId]);
 assert.equal(await jobs.ownsLease({invitationId:'invite',tenantId:'tenant',ownerId:'invalid'}),false);
});

test('B425 lease renewal requires current unexpired owner',async()=>{
 let sql,params;
 const jobs=createPgNonceCleanupJobs(async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[{}]};});
 const ownerId='11111111-1111-4111-8111-111111111111';
 assert.equal(await jobs.renewLease({invitationId:'invite',tenantId:'tenant',ownerId,leaseSeconds:30}),true);
 assert.match(sql,/lease_owner=\$3::uuid AND lease_until>now\(\)/);
 assert.deepEqual(params,['invite','tenant',ownerId,30]);
 await assert.rejects(jobs.renewLease({invitationId:'invite',tenantId:'tenant',ownerId,leaseSeconds:601}),/INVALID_NONCE_LEASE_RENEWAL/);
});
