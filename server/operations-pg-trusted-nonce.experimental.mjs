// B405 isolated server-owned nonce challenge binding.
// Raw challenges must be retained only in a trusted ephemeral server store,
// never returned by invitation context lookup to arbitrary unauthenticated callers.
import {createHash,timingSafeEqual} from 'node:crypto';
const digest=v=>createHash('sha256').update(v,'utf8').digest('hex');
export function createTrustedNonceResolver({lookupChallenge,readServerNonce}){
 if(typeof lookupChallenge!=='function'||typeof readServerNonce!=='function')
  throw Error('TRUSTED_NONCE_CONFIGURATION_REQUIRED');
 return async function resolveNonce({invitationId,tenantId}={}){
  if(!invitationId||!tenantId)return null;
  const nonce=await readServerNonce({invitationId,tenantId});
  if(typeof nonce!=='string'||nonce.length<16)return null;
  const record=await lookupChallenge({invitationId,tenantId,nonceHash:digest(nonce)});
  if(!record||record.active!==true||record.invitationId!==invitationId
   ||record.tenantId!==tenantId||typeof record.nonceHash!=='string')return null;
  const expected=Buffer.from(record.nonceHash,'hex');
  const actual=Buffer.from(digest(nonce),'hex');
  if(expected.length!==32||!timingSafeEqual(expected,actual))return null;
  return nonce;
 };
}
