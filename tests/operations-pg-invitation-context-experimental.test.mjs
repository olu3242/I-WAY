import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgInvitationContextResolver} from '../server/operations-pg-invitation-context.experimental.mjs';
const id='a1010101-0101-4101-8101-010101010101';
const row={id,tenant_id:'tenant',creator_id:'creator',assignment:{role:'driver'}};
test('resolves trusted role tenant actor and nonce from database',async()=>{
 let sql,params;
 const resolve=createPgInvitationContextResolver({
  query:async(q,p)=>{sql=q;params=p;return {rowCount:1,rows:[row]};},
  resolveNonce:async()=> 'server-nonce'
 });
 assert.deepEqual(await resolve({invitationId:id}),{invitationId:id,tenantId:'tenant',actorId:'creator',role:'driver',expectedNonce:'server-nonce'});
 assert.match(sql,/state='VERIFIED' AND expires_at>now\(\)/);
 assert.deepEqual(params,[id]);
});
test('unknown or expired invitation returns no context',async()=>{
 const resolve=createPgInvitationContextResolver({query:async()=>({rowCount:0,rows:[]}),resolveNonce:async()=>{throw Error('unexpected')}});
 assert.equal(await resolve({invitationId:id}),null);
});
test('missing server nonce denies provisioning context',async()=>{
 const resolve=createPgInvitationContextResolver({query:async()=>({rowCount:1,rows:[row]}),resolveNonce:async()=>null});
 assert.equal(await resolve({invitationId:id}),null);
});
test('invalid identifier rejected without database query',async()=>{
 const resolve=createPgInvitationContextResolver({query:async()=>{throw Error('unexpected')},resolveNonce:async()=>{throw Error('unexpected')}});
 assert.equal(await resolve({invitationId:'../../other-tenant'}),null);
});
