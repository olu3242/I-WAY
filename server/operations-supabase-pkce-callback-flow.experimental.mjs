import {assertPkceState,readAuthCookie,PKCE_COOKIE,pkceTransactionCookie,clearPkceCookie,createPkceTransaction} from './operations-supabase-pkce-session.experimental.mjs';
import {parseSupabaseAuthCallback} from './operations-supabase-auth-callback.experimental.mjs';

export function createSupabaseLogin({saveTransaction,consumeTransaction,authorizationUrl}={}){
 if(![saveTransaction,consumeTransaction,authorizationUrl].every(fn=>typeof fn==='function'))
  throw Error('PKCE_LOGIN_DEPENDENCIES_REQUIRED');
 return async function login({headers}={}){
  const transaction=createPkceTransaction();
  try{
   const previous=readAuthCookie(headers,PKCE_COOKIE);
   if(previous)await consumeTransaction(previous);
   await saveTransaction(transaction);
   const location=authorizationUrl({challenge:transaction.challenge});
   return {ok:true,location,cookie:pkceTransactionCookie({value:transaction.state})};
  }catch{
   await consumeTransaction(transaction.state).catch(()=>{});
   return {ok:false,error:'AUTH_LOGIN_UNAVAILABLE',cookie:clearPkceCookie()};
  }
 };
}

export function createSupabasePkceCallback({consumeTransaction,exchangeCode,createSession,expectedOrigin}={}){
 if(![consumeTransaction,exchangeCode,createSession].every(fn=>typeof fn==='function')||
    typeof expectedOrigin!=='string'||new URL(expectedOrigin).origin!==expectedOrigin||!expectedOrigin.startsWith('https://'))
  throw Error('PKCE_CALLBACK_DEPENDENCIES_REQUIRED');
 return async function callback({url,headers}={}){
  try{
   const state=readAuthCookie(headers,PKCE_COOKIE);
   if(!state)throw Error('PKCE_BROWSER_TRANSACTION_REQUIRED');
   const parsed=parseSupabaseAuthCallback(url,{expectedOrigin,expectedState:state});
   const transaction=await consumeTransaction(state);
   if(!transaction||typeof transaction.verifier!=='string'||typeof transaction.state!=='string')
    throw Error('PKCE_TRANSACTION_EXPIRED_OR_REPLAYED');
   assertPkceState(state,transaction.state);
   // An exchange has an uncertain outcome on network failure: do not retry a one-time code.
   const response=await exchangeCode({code:parsed.code,verifier:transaction.verifier});
   if(!response?.user?.id||!response?.accessToken||!response?.refreshToken)
    throw Error('PKCE_EXCHANGE_FAILED');
   const session=await createSession({userId:response.user.id,accessToken:response.accessToken,
    refreshToken:response.refreshToken,accessExpiresAt:response.accessExpiresAt});
   if(typeof session?.id!=='string'||!session.id)throw Error('PKCE_SESSION_PERSISTENCE_FAILED');
   return {ok:true,sessionId:session.id};
  }catch{return {ok:false,error:'AUTH_CALLBACK_REJECTED'};}
 };
}
