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
