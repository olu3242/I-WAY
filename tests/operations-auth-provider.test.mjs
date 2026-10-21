import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseProvider} from '../server/operations-supabase-provider.mjs';
const user='11111111-1111-4111-8111-111111111111';
const options={url:'https://vnoxdinldneeczxibicp.supabase.co',apiKey:'synthetic-key',provider:'github',redirectTo:'https://staging.example.org/auth/callback'};
const json=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
test('provider uses pinned PKCE exchange and independently verifies identity',async()=>{
 const requests=[];
 const provider=createSupabaseProvider({...options,fetchImpl:async(url,request)=>{requests.push({url,request});return url.endsWith('/user')?json({id:user,user_metadata:{role:'platform'}}):json({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600,token_type:'bearer',user:{id:user}});}});
 const target=new URL(provider.authorizationUrl({challenge:'c'.repeat(43)}));
 assert.equal(target.searchParams.get('code_challenge_method'),'s256');assert.equal(target.searchParams.get('state'),null);
 const result=await provider.exchangeCode({code:'code',verifier:'v'.repeat(43)});
 assert.deepEqual(result.user,{id:user});assert.equal(requests.length,2);
 assert.deepEqual(JSON.parse(requests[0].request.body),{auth_code:'code',code_verifier:'v'.repeat(43)});
 assert.equal(requests[1].request.headers.authorization,'Bearer private-access');
 assert.equal(requests[0].request.redirect,'error');
});
test('provider rejects invalid identity, expired response, oversized response and outage without secrets',async()=>{
 for(const mode of ['mismatch','expiry','oversize','outage']){
  let calls=0;
  const provider=createSupabaseProvider({...options,fetchImpl:async(url)=>{calls++;if(mode==='outage')throw Error('private-refresh');if(mode==='oversize')return json({data:'x'.repeat(70000)});if(url.endsWith('/user'))return json({id:'22222222-2222-4222-8222-222222222222'});return json({access_token:'private-access',refresh_token:'private-refresh',expires_in:mode==='expiry'?0:300,token_type:'bearer',user:{id:user}});}});
  await assert.rejects(provider.exchangeCode({code:'code',verifier:'v'.repeat(43)}),error=>!error.message.includes('private')&&error.message.startsWith('AUTH_PROVIDER'));
  assert.ok(calls<=2);
 }
});
test('provider never retries a failed one-time exchange and bounds request lifetime',async()=>{
 let calls=0;
 const provider=createSupabaseProvider({...options,timeoutMs:20,fetchImpl:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>{const timer=setTimeout(resolve,200);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('timeout'));},{once:true});});}});
 await assert.rejects(provider.exchangeCode({code:'code',verifier:'v'.repeat(43)}),/AUTH_PROVIDER_UNAVAILABLE/);assert.equal(calls,1);
});
