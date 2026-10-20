// B412 isolated in-memory challenge custody for fixture-only testing.
// Never use as durable, distributed, or production session storage.
export function createEphemeralNonceStore({clock=()=>Date.now(),ttlMs=300000}={}){
 if(typeof clock!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>600000)
  throw Error('NONCE_STORE_CONFIGURATION_REQUIRED');
 const entries=new Map();
 const key=({invitationId,tenantId})=>JSON.stringify([invitationId,tenantId]);
 return Object.freeze({
  async storeNonce({invitationId,tenantId,nonce}){
   if(!invitationId||!tenantId||typeof nonce!=='string'||nonce.length<16)
    throw Error('INVALID_NONCE_STORE_REQUEST');
   const k=key({invitationId,tenantId});
   const prior=entries.get(k);
   if(prior&&prior.expiresAt>clock())throw Error('NONCE_ALREADY_STORED');
   entries.set(k,{nonce,expiresAt:clock()+ttlMs});
  },
  async readNonce({invitationId,tenantId}){
   const k=key({invitationId,tenantId});
   const entry=entries.get(k);
   if(!entry)return null;
   if(entry.expiresAt<=clock()){entries.delete(k);return null;}
   return entry.nonce;
  },
  async clearNonce({invitationId,tenantId}){
   entries.delete(key({invitationId,tenantId}));
  }
 });
}
