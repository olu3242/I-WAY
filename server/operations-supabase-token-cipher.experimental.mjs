// B457: AES-256-GCM authenticated encryption for server-side provider tokens.
// Key must come from server-only secret management, never from browser configuration.
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function createServerTokenCipher({key}={}){
 const secret=typeof key==='string'?Buffer.from(key,'base64url'):key;
 if(!Buffer.isBuffer(secret)||secret.length!==32)throw Error('TOKEN_ENCRYPTION_KEY_REQUIRED');
 return Object.freeze({
  encrypt(value){
   if(typeof value!=='string'||!value)throw Error('TOKEN_ENCRYPTION_INPUT_INVALID');
   const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);
   const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
   return 'v1.'+iv.toString('base64url')+'.'+cipher.getAuthTag().toString('base64url')+'.'+ciphertext.toString('base64url');
  },
  decrypt(value){
   if(typeof value!=='string')throw Error('TOKEN_CIPHERTEXT_INVALID');
   const parts=value.split('.');
   if(parts.length!==4||parts[0]!=='v1')throw Error('TOKEN_CIPHERTEXT_INVALID');
   try{
    const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url'),body=Buffer.from(parts[3],'base64url');
    if(iv.length!==12||tag.length!==16||body.length===0)throw Error('invalid');
    const decipher=createDecipheriv('aes-256-gcm',secret,iv);decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8');
   }catch{throw Error('TOKEN_CIPHERTEXT_INVALID');}
  }
 });
}
