import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPgNonceCustody} from '../server/operations-pg-nonce-custody.experimental.mjs';
test('B436 verifies nonce digest with tenant and expiry scope',async()=>{
 let sql,params;
 const custody=createPgNonceCustody(async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[{}]};});
 const nonce='nonce-value-0123456789';
 assert.equal(await custody.verifyUnconsumed({invitationId:'i',tenantId:'t',nonce}),true);
 assert.match(sql,/consumed_at IS NULL AND expires_at>now\(\)/);
 assert.deepEqual(params,['i','t',createHash('sha256').update(nonce).digest('hex')]);
 assert.equal(JSON.stringify(params).includes(nonce),false);
});
test('B436 rejects invalid nonce scope and counts only consumed challenges',async()=>{
 const custody=createPgNonceCustody(async(q,p)=>({rowCount:1,rows:[{total:2}]}));
 await assert.rejects(custody.verifyUnconsumed({invitationId:'i',tenantId:'t',nonce:'short'}),/INVALID_NONCE_CUSTODY_REQUEST/);
 assert.equal(await custody.consumedCount({invitationId:'i',tenantId:'t'}),2);
});
