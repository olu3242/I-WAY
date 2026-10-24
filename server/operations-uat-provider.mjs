// Candidate server-only Supabase REST adapter. No admin key, signup, email sender,
// automatic linking or OAuth token decoding without signature verification.
import {verifyIdentityProof} from './operations-identity.mjs';
const projectOrigin='https://vnoxdinldneeczxibicp.supabase.co';
// Supabase Auth serializes provider_id as `id`; identity_id is the database UUID.
// See supabase/auth internal/models/identity.go and auth-js UserIdentity.
export function verifiedGoogleSubjects(user){
 return (Array.isArray(user?.identities)?user.identities:[]).filter(i=>i.provider==='google'&&i.user_id===user.id&&typeof i.id==='string'&&!!i.id&&i.identity_data?.sub===i.id&&(i.provider_id===undefined||i.provider_id===i.id)).map(i=>i.id);
}
export function createUatSupabaseProvider({apiKey,verifier,fetchImpl=fetch,clock=()=>Date.now()}={}){
 if(typeof apiKey!=='string'||!apiKey||/[\r\n]/.test(apiKey)||!verifier)throw Error('UAT_PROVIDER_CONFIG_REQUIRED');
 async function request(path,{method='GET',body,accessToken}={}){
  try{
   const response=await fetchImpl(projectOrigin+'/auth/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:apiKey,'content-type':'application/json',...(accessToken?{authorization:'Bearer '+accessToken}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok)throw Error();if(response.status===204)return null;
   if(!response.headers.get('content-type')?.includes('application/json'))throw Error();
   const reader=response.body.getReader();let count=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>65536)throw Error();chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{throw Error('UAT_PROVIDER_UNAVAILABLE');}
 }
 async function inspect(accessToken){
  const proof=verifyIdentityProof(verifier,accessToken,clock());
  if(proof.issuer!==projectOrigin+'/auth/v1'||proof.audience!=='authenticated')throw Error('UAT_IDENTITY_REJECTED');
  const user=await request('/user',{accessToken});
  if(user?.id!==proof.subject||user.is_anonymous===true||!user.email_confirmed_at||user.banned_until&&Date.parse(user.banned_until)>clock())throw Error('UAT_IDENTITY_REJECTED');
  return {id:user.id,email:user.email,emailConfirmed:true,anonymous:false,assurance:proof.assurance,
   googleSubjects:verifiedGoogleSubjects(user)};
 }
 async function tokens(result){
  if(typeof result?.access_token!=='string'||typeof result?.refresh_token!=='string'||result.token_type?.toLowerCase()!=='bearer'||!Number.isInteger(result.expires_in)||result.expires_in<1||result.expires_in>86400)throw Error('UAT_PROVIDER_RESPONSE_INVALID');
  const identity=await inspect(result.access_token);if(result.user?.id&&result.user.id!==identity.id)throw Error('UAT_IDENTITY_REJECTED');
  return {user:{id:identity.id},accessToken:result.access_token,refreshToken:result.refresh_token,accessExpiresAt:new Date(clock()+result.expires_in*1000)};
 }
 return Object.freeze({
  inspect,
  passwordLogin:async({email,password})=>tokens(await request('/token?grant_type=password',{method:'POST',body:{email,password}})),
  verifySetup:async tokenHash=>tokens(await request('/verify',{method:'POST',body:{type:'recovery',token_hash:tokenHash}})),
  async setPassword(accessToken,password){await inspect(accessToken);await request('/user',{method:'PUT',accessToken,body:{password}});},
  refresh:async refreshToken=>tokens(await request('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}})),
  async logout(accessToken){await request('/logout?scope=local',{method:'POST',accessToken});},
  async challengeMfa(accessToken){
   await inspect(accessToken);const user=await request('/user',{accessToken});
   const factor=user.factors?.find(f=>f.factor_type==='totp'&&f.status==='verified');if(!factor||!/^[0-9a-f-]{36}$/i.test(factor.id))throw Error('UAT_MFA_ENROLLMENT_REQUIRED');
   const result=await request('/factors/'+factor.id+'/challenge',{method:'POST',accessToken,body:{}});
   if(typeof result?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(result.id))throw Error('UAT_MFA_REJECTED');
   return {factorId:factor.id,challengeId:result.id};
  },
  async verifyMfa(current,code){
   const {factorId,challengeId}=current.challenge??{};if(!/^[0-9a-f-]{36}$/i.test(factorId)||!/^[0-9a-f-]{36}$/i.test(challengeId)||!/^\d{6}$/.test(code))throw Error('UAT_MFA_REJECTED');
   return tokens(await request('/factors/'+factorId+'/verify',{method:'POST',accessToken:current.accessToken,body:{challenge_id:challengeId,code}}));
  }
 });
}
// Privileged adapter belongs ONLY in a separately approved administration workflow.
// Recovery type targets an already provisioned user, never generates a password.
export function createUatRecoveryIssuer({adminClient}={}){
 if(typeof adminClient?.auth?.admin?.generateLink!=='function')throw Error('UAT_ADMIN_ISSUER_REQUIRED');
 return Object.freeze({async generateRecovery({email,userId}){
  try{const {data,error}=await adminClient.auth.admin.generateLink({type:'recovery',email});
   if(error||data?.user?.id!==userId||typeof data.properties?.hashed_token!=='string')throw Error();
   return {userId,tokenHash:data.properties.hashed_token};
  }catch{throw Error('UAT_ISSUER_UNAVAILABLE');}
 }});
}
