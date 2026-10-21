// B454: one-time, server-side PKCE callback orchestration.
// The store MUST implement atomic consume(state) and TTL expiration in shared storage.
// No Supabase tokens are returned to the browser.
import {assertPkceState} from './operations-supabase-pkce-session.experimental.mjs';
import {parseSupabaseAuthCallback} from './operations-supabase-auth-callback.experimental.mjs';
export function createSupabasePkceCallback({consumeTransaction,exchangeCode,createSession,expectedOrigin}={}){
 if(![consumeTransaction,exchangeCode,createSession].every(fn=>typeof fn==='function')||
 typeof expectedOrigin!=='string'||!expectedOrigin.startsWith('https://'))
 throw Error('PKCE_CALLBACK_DEPENDENCIES_REQUIRED');
 return async function callback({url}={}){
  let parsed;
  try{
   const input=new URL(url);
   const state=input.searchParams.get('state');
   if(!state||input.searchParams.getAll('state').length!==1)throw Error('PKCE_STATE_MISSING');
   // Validate callback origin, path, state shape and code BEFORE consuming shared state.
   // An attacker-controlled callback must not burn a legitimate login transaction.
   parsed=parseSupabaseAuthCallback(url,{expectedOrigin,expectedState:state});
   // Consume before exchanging: failed exchange cannot be replayed.
   const transaction=await consumeTransaction(state);
   if(!transaction||typeof transaction.verifier!=='string'||typeof transaction.state!=='string')
    throw Error('PKCE_TRANSACTION_EXPIRED_OR_REPLAYED');
   assertPkceState(state,transaction.state);
   const response=await exchangeCode({code:parsed.code,verifier:transaction.verifier});
   if(!response?.user?.id||!response?.accessToken||!response?.refreshToken)
    throw Error('PKCE_EXCHANGE_FAILED');
   const session=await createSession({userId:response.user.id,accessToken:response.accessToken,refreshToken:response.refreshToken});
   if(typeof session?.id!=='string'||!session.id)throw Error('PKCE_SESSION_PERSISTENCE_FAILED');
   return {ok:true,sessionId:session.id};
  }catch{return {ok:false,error:'AUTH_CALLBACK_REJECTED'};}
 };
}
