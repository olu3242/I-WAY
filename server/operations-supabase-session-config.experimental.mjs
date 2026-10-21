// B463: fail-closed server-only session configuration.
// Never default to a generated ephemeral key: it would invalidate sessions on restart.
import {createServerTokenCipher} from './operations-supabase-token-cipher.experimental.mjs';
export function createConfiguredSessionCipher(env=process.env){
 const key=env.IWAY_SESSION_ENCRYPTION_KEY;
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(key))
  throw Error('IWAY_SESSION_ENCRYPTION_KEY_INVALID');
 return createServerTokenCipher({key});
}
export function assertPrivateAuthStorageReady({query,cipher}={}){
 if(typeof query!=='function'||typeof cipher?.encrypt!=='function'||typeof cipher?.decrypt!=='function')
  throw Error('PRIVATE_AUTH_STORAGE_NOT_CONFIGURED');
 return true;
}
