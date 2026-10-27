// Experimental hosted OIDC verifier adapter. No production runtime wiring.
// Uses Node's WebCrypto and pinned issuer/audience/JWKS endpoint supplied by
// the operator. Never trusts JWT headers for network destinations.
import {createPublicKey,verify as verifySignature} from 'node:crypto';
const decode=v=>JSON.parse(Buffer.from(v,'base64url').toString('utf8'));
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a===b;
export function createHostedOidcVerifier({issuer,audience,jwks,clock=()=>Date.now(),enabled=false}){
 if(!enabled)throw Error('HOSTED_OIDC_DISABLED');
 if(typeof issuer!=='string'||!issuer.startsWith('https://')||!audience
 ||!jwks||!Array.isArray(jwks.keys))throw Error('OIDC_CONFIGURATION_REQUIRED');
 return async function verifyIdentity(token,{nonce}={}){
  if(typeof token!=='string'||token.length>16384||token.split('.').length!==3)
   throw Error('OIDC_TOKEN_REJECTED');
  try{
   const [h,p,s]=token.split('.');
   const header=decode(h),claims=decode(p);
   if(header.alg!=='RS256'||header.typ&&header.typ!=='JWT'||typeof header.kid!=='string')
    throw Error('OIDC_ALGORITHM_REJECTED');
   const key=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use!=='enc'&&(!k.alg||k.alg==='RS256'));
   if(!key)throw Error('OIDC_KEY_REJECTED');
   const now=Math.floor(clock()/1000);
   if(!equal(claims.iss,issuer)||!(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience)
    ||!Number.isInteger(claims.exp)||claims.exp<=now||!Number.isInteger(claims.iat)||claims.iat>now+60
    ||(claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>now))
    ||typeof claims.sub!=='string'||!claims.sub
    ||typeof nonce!=='string'||!nonce||claims.nonce!==nonce)
    throw Error('OIDC_CLAIMS_REJECTED');
   const publicKey=createPublicKey({key,format:'jwk'});
   if(!verifySignature('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(s,'base64url')))
    throw Error('OIDC_SIGNATURE_REJECTED');
   return Object.freeze({verified:true,issuer:claims.iss,subject:claims.sub,audience,
    mfaVerified:Array.isArray(claims.amr)&&claims.amr.includes('mfa')});
  }catch{
   throw Error('OIDC_TOKEN_REJECTED');
  }
 };
}
