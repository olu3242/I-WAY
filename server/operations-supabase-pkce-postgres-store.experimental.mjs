// One-time consume deactivates retained transaction metadata and erases the encrypted verifier.
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(v);
export function createPostgresPkceTransactionStore({query,cipher,clock=()=>new Date()}={}){
 if(typeof query!=='function'||typeof cipher?.encrypt!=='function'||typeof cipher?.decrypt!=='function')throw Error('PKCE_STORE_SECURE_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  async save({state,verifier,ttlSeconds=600}={}){
   if(!valid(state)||!valid(verifier)||!Number.isInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>600)throw Error('PKCE_TRANSACTION_INVALID');
   const result=await query(`INSERT INTO iway_private.auth_pkce_transactions(state_hash,verifier,expires_at)
    VALUES($1,$2,$3) ON CONFLICT(state_hash) DO NOTHING RETURNING state_hash`,
    [digest(state),cipher.encrypt(verifier),new Date(clock().getTime()+ttlSeconds*1000)]);
   if(result.rowCount!==1)throw Error('PKCE_TRANSACTION_NOT_SAVED');
   return true;
  },
  async consume(state){
   if(!valid(state))return null;
   const result=await query(`WITH candidate AS MATERIALIZED (
     SELECT state_hash,verifier FROM iway_private.auth_pkce_transactions
     WHERE state_hash=$1 AND expires_at>$2 AND consumed_at IS NULL FOR UPDATE
    ), consumed AS (
     UPDATE iway_private.auth_pkce_transactions t SET consumed_at=$2,verifier=NULL
     FROM candidate c WHERE t.state_hash=c.state_hash AND t.consumed_at IS NULL RETURNING t.state_hash
    ) SELECT c.verifier FROM candidate c JOIN consumed USING(state_hash)`,[digest(state),clock()]);
   if(result.rowCount!==1)return null;
   try{return {state,verifier:cipher.decrypt(result.rows[0].verifier)};}catch{throw Error('PKCE_VERIFIER_DECRYPTION_FAILED');}
  },
  async expire(){
   const result=await query(`UPDATE iway_private.auth_pkce_transactions SET consumed_at=$1,verifier=NULL
    WHERE consumed_at IS NULL AND expires_at<=$1`,[clock()]);
   return result.rowCount;
  }
 });
}
