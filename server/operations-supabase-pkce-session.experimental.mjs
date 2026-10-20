// B453: server-only PKCE transaction primitives. No browser tokens or service keys.
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const b64=bytes=>Buffer.from(bytes).toString('base64url');
export function createPkceTransaction(){
 const verifier=b64(randomBytes(32));
 const state=b64(randomBytes(32));
 const challenge=b64(createHash('sha256').update(verifier).digest());
 return Object.freeze({verifier,state,challenge,method:'S256'});
}
export function assertPkceState(actual,expected){
 if(typeof actual!=='string'||typeof expected!=='string'||!actual||!expected)throw Error('PKCE_STATE_MISSING');
 const a=Buffer.from(actual),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('PKCE_STATE_MISMATCH');
 return true;
}
export function pkceTransactionCookie({name='__Host-iway-pkce',value,maxAge=600}={}){
 if(!/^__Host-[A-Za-z0-9-]+$/.test(name)||typeof value!=='string'||!/^[A-Za-z0-9_-]{40,128}$/.test(value)||!Number.isInteger(maxAge)||maxAge<1||maxAge>600)throw Error('PKCE_COOKIE_INVALID');
 return name+'='+value+'; Path=/; Max-Age='+maxAge+'; HttpOnly; Secure; SameSite=Lax';
}
export function sessionCookie({value,maxAge=3600}={}){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{32,512}$/.test(value)||!Number.isInteger(maxAge)||maxAge<1||maxAge>3600)throw Error('SESSION_COOKIE_INVALID');
 return '__Host-iway-session='+value+'; Path=/; Max-Age='+maxAge+'; HttpOnly; Secure; SameSite=Lax';
}
export const clearPkceCookie=()=> '__Host-iway-pkce=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
export const clearSessionCookie=()=> '__Host-iway-session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
