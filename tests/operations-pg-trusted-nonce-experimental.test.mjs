import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createTrustedNonceResolver} from '../server/operations-pg-trusted-nonce.experimental.mjs';
const nonce='server-generated-nonce-0123456789',id='invite',tenant='tenant';
const digest=v=>createHash('sha256').update(v).digest('hex');
const good={active:true,invitationId:id,tenantId:tenant,nonceHash:digest(nonce)};
function make(record=good,value=nonce){
 return createTrustedNonceResolver({readServerNonce:async()=>value,lookupChallenge:async()=>record});
}
test('resolves only server-owned nonce bound to matching active challenge',async()=>{
 assert.equal(await make()({invitationId:id,tenantId:tenant}),nonce);
});
for(const [name,record,value] of [
 ['expired challenge',{...good,active:false},nonce],
 ['wrong tenant',{...good,tenantId:'other'},nonce],
 ['wrong invitation',{...good,invitationId:'other'},nonce],
 ['wrong nonce hash',{...good,nonceHash:digest('different')},nonce],
 ['missing challenge',null,nonce],
 ['missing server nonce',good,null]
]){
 test('rejects '+name,async()=>assert.equal(await make(record,value)({invitationId:id,tenantId:tenant}),null));
}
