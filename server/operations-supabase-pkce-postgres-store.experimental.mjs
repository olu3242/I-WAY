// B455: PostgreSQL-backed, atomic one-time PKCE transaction store.
// Uses trusted server-side SQL only. Expects a private table provisioned separately.
// Atomic DELETE ... RETURNING prevents replay across concurrent instances.
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function createPostgresPkceTransactionStore({query,clock=()=>new Date()}={}){
 if(typeof query!=='function')throw Error('PKCE_STORE_QUERY_REQUIRED');
 return Object.freeze({
  async save({state,verifier,ttlSeconds=600}={}){
   if(!valid(state)||!valid(verifier)||!Number.isInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>600)
    throw Error('PKCE_TRANSACTION_INVALID');
   const result=await query(`INSERT INTO iway_private.auth_pkce_transactions(state_hash,verifier,expires_at)
    VALUES($1,$2,$3) ON CONFLICT(state_hash) DO NOTHING RETURNING state_hash`,
    [digest(state),verifier,new Date(clock().getTime()+ttlSeconds*1000)]);
   if(result.rowCount!==1)throw Error('PKCE_TRANSACTION_NOT_SAVED');
   return true;
  },
  async consume(state){
   if(!valid(state))return null;
   const result=await query(`DELETE FROM iway_private.auth_pkce_transactions
    WHERE state_hash=$1 AND expires_at> $2 RETURNING verifier`,[digest(state),clock()]);
   if(result.rowCount!==1)return null;
   return {state,verifier:result.rows[0].verifier};
  }
 });
}
function valid(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(v);}
