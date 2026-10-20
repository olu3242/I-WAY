import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgNonceChallenges} from '../server/operations-pg-nonce-challenges.experimental.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('issues unpredictable nonce and stores digest only',async()=>{
 const writes=[];
 const repo=createPgNonceChallenges(async fn=>fn({query:async(sql,args)=>{if(sql.includes('INSERT INTO'))writes.push(args);return {rowCount:sql.includes('SELECT nonce_hash')?0:1}}}));
 const nonce=await repo.issue({invitationId:id,tenantId:id});
 assert.ok(nonce.length>=40);
 assert.equal(writes.length,1);
 assert.notEqual(writes[0][0],nonce);
 assert.match(writes[0][0],/^[a-f0-9]{64}$/);
});
test('nonce consumption rejects missing, stale or reused proof',async()=>{
 const repo=createPgNonceChallenges(async()=>{});
 await assert.rejects(repo.consume({query:async()=>({rowCount:0})},{nonce:'nonce',invitationId:id,tenantId:id}),/NONCE_CONSUMPTION_REJECTED/);
});
test('nonce consumption is scoped to caller transaction',async()=>{
 let sql,params;
 const repo=createPgNonceChallenges(async()=>{});
 await repo.consume({query:async(q,p)=>{sql=q;params=p;return {rowCount:1}}},{nonce:'nonce',invitationId:id,tenantId:id});
 assert.match(sql,/consumed_at IS NULL AND expires_at>now\(\)/);
 assert.equal(params[1],id);assert.equal(params[2],id);
});
test('nonce TTL is bounded',async()=>{
 const repo=createPgNonceChallenges(async()=>{throw Error('unexpected transaction')});
 await assert.rejects(repo.issue({invitationId:id,tenantId:id,ttlSeconds:9999}),/INVALID_NONCE_CHALLENGE/);
});
