import {uatOrigin} from './operations-uat-target.mjs';
// Supported Supabase Auth REST contract; only the pinned project is reachable.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const token=value=>typeof value==='string'&&value.length>0&&value.length<=16384&&!/[\r\n]/.test(value);
export function createSupabaseProvider({url,apiKey,provider,redirectTo,fetchImpl=fetch,clock=()=>Date.now(),timeoutMs=8000}={}){
 if(url!==uatOrigin||!token(apiKey)||!['google','github','azure'].includes(provider)||
    !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('AUTH_PROVIDER_CONFIGURATION_INVALID');
 const callback=new URL(redirectTo);
 if(callback.protocol!=='https:'||callback.username||callback.password||callback.pathname!=='/auth/callback'||callback.search||callback.hash)
  throw Error('AUTH_PROVIDER_CONFIGURATION_INVALID');
 async function request(path,{method='GET',body,accessToken}={}){
  try{
   const response=await fetchImpl(url+'/auth/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(timeoutMs),
    headers:{apikey:apiKey,'content-type':'application/json',...(accessToken?{authorization:'Bearer '+accessToken}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok)throw Error('AUTH_PROVIDER_REJECTED');
   if(response.status===204)return null;
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error('AUTH_PROVIDER_RESPONSE_INVALID');
   const reader=response.body.getReader();let size=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('AUTH_PROVIDER_RESPONSE_INVALID');chunks.push(Buffer.from(value));}}
   finally{await reader.cancel().catch(()=>{});}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{throw Error('AUTH_PROVIDER_UNAVAILABLE');}
 }
 async function getUser(accessToken){
  if(!token(accessToken))throw Error('AUTH_PROVIDER_IDENTITY_INVALID');
  const user=await request('/user',{accessToken});
  if(!uuid(user?.id)||user?.is_anonymous===true)throw Error('AUTH_PROVIDER_IDENTITY_INVALID');
  return {id:user.id};
 }
 async function exchange(grant,body){
  const result=await request('/token?grant_type='+grant,{method:'POST',body});
  if(!token(result?.access_token)||!token(result?.refresh_token)||result?.token_type?.toLowerCase()!=='bearer'||
     !Number.isInteger(result?.expires_in)||result.expires_in<1||result.expires_in>86400)
   throw Error('AUTH_PROVIDER_RESPONSE_INVALID');
  const user=await getUser(result.access_token);
  if(result.user?.id&&result.user.id!==user.id)throw Error('AUTH_PROVIDER_IDENTITY_INVALID');
  return {user,accessToken:result.access_token,refreshToken:result.refresh_token,accessExpiresAt:new Date(clock()+result.expires_in*1000)};
 }
 return Object.freeze({
  authorizationUrl({challenge}){
   if(typeof challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw Error('PKCE_CHALLENGE_INVALID');
   const target=new URL(url+'/auth/v1/authorize');
   for(const [key,value] of Object.entries({provider,redirect_to:redirectTo,code_challenge:challenge,code_challenge_method:'s256'}))target.searchParams.set(key,value);
   return target.href;
  },
  exchangeCode({code,verifier}){
   if(typeof code!=='string'||!code||code.length>2048||typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))
    throw Error('PKCE_EXCHANGE_INPUT_INVALID');
   return exchange('pkce',{auth_code:code,code_verifier:verifier});
  },
  refresh(refreshToken){if(!token(refreshToken))throw Error('AUTH_REFRESH_INVALID');return exchange('refresh_token',{refresh_token:refreshToken});},
  getUser,
  async logout(accessToken){if(!token(accessToken))return;await request('/logout?scope=local',{method:'POST',accessToken});}
 });
}
