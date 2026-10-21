import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServerTokenCipher} from '../server/operations-supabase-token-cipher.experimental.mjs';
import {createPostgresPkceTransactionStore} from '../server/operations-supabase-pkce-postgres-store.experimental.mjs';
test('B455 hashes state at rest and atomically consumes transaction',async()=>{
 const rows=new Map();let stateHash;
 const cipher=createServerTokenCipher({key:randomBytes(32)});
 const query=async(sql,params)=>{
 if(sql.includes('INSERT')){stateHash=params[0];rows.set(params[0],{verifier:params[1],expiresAt:params[2]});return {rowCount:1};}
 const row=rows.get(params[0]);if(!row||row.expiresAt<=params[1])return {rowCount:0,rows:[]};
 rows.delete(params[0]);return {rowCount:1,rows:[{verifier:row.verifier}]};
 };
 const store=createPostgresPkceTransactionStore({query,cipher});
 const state='s'.repeat(43),verifier='v'.repeat(43);
 await store.save({state,verifier});
 assert.notEqual(rows.get(stateHash).verifier,verifier);
 assert.notEqual(stateHash,state);assert.equal(stateHash.length,64);
 assert.deepEqual(await store.consume(state),{state,verifier});
 assert.equal(await store.consume(state),null);
});
test('B455 denies malformed and expired state',async()=>{
 const store=createPostgresPkceTransactionStore({query:async()=>({rowCount:0,rows:[]}),cipher:createServerTokenCipher({key:randomBytes(32)})});
 assert.equal(await store.consume('invalid'),null);
 await assert.rejects(store.save({state:'short',verifier:'v'.repeat(43)}),/PKCE_TRANSACTION_INVALID/);
});
