import {createPublicKey} from 'node:crypto';
import {createIdentityVerifier} from './operations-identity.mjs';
import {uatIssuer as issuer} from './operations-uat-target.mjs';
// Public asymmetric keys only; legacy shared JWT secrets are never loaded here.
export async function loadHostedUatVerifier({fetchImpl=fetch}={}){
 try{
  const response=await fetchImpl(issuer+'/.well-known/jwks.json',{redirect:'error',signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error();
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error();chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  const jwks=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(jwks.keys)||jwks.keys.length<1||jwks.keys.length>8)throw Error();
  const keys=jwks.keys.map(key=>{
   if(!key||!['RS256','ES256'].includes(key.alg)||typeof key.kid!=='string'||!key.kid||key.kid.length>80||key.use&&key.use!=='sig'||key.key_ops&&(!Array.isArray(key.key_ops)||key.key_ops.some(value=>value!=='verify'))||['d','p','q','dp','dq','qi','oth','k'].some(name=>Object.hasOwn(key,name)))throw Error();
   return {kid:key.kid,algorithm:key.alg,publicKey:createPublicKey({key,format:'jwk'})};
  });
  return createIdentityVerifier({issuer,audience:'authenticated',keys,requireMfa:false,maxTokenAgeSeconds:3600});
 }catch{throw Error('UAT_PUBLIC_SIGNING_KEYS_UNAVAILABLE');}
}
