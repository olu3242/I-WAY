// B456: server-side opaque session persistence; never send provider tokens to clients.
// Requires a privileged private PostgreSQL connection and encrypted-at-rest database storage.
import {randomBytes,createHash} from 'node:crypto';
const hash=id=>createHash('sha256').update(id).digest('hex');
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(id);
export function createPostgresOpaqueSessionStore({query,cipher,clock=()=>new Date()}={}){
 if(typeof query!=='function'||typeof cipher?.encrypt!=='function'||typeof cipher?.decrypt!=='function')throw Error('SESSION_STORE_SECURE_DEPENDENCIES_REQUIRED');
 return Object.freeze({
  async create({userId,accessToken,refreshToken,ttlSeconds=3600}={}){
   if(typeof userId!=='string'||!/^[0-9a-f-]{36}$/i.test(userId)||
    typeof accessToken!=='string'||!accessToken||typeof refreshToken!=='string'||!refreshToken||
    !Number.isInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600)throw Error('SESSION_INVALID');
   const id=randomBytes(32).toString('base64url');
   const result=await query(`INSERT INTO iway_private.auth_server_sessions
    (session_hash,user_id,access_token,refresh_token,expires_at)
    VALUES($1,$2,$3,$4,$5) RETURNING session_hash`,
    [hash(id),userId,cipher.encrypt(accessToken),cipher.encrypt(refreshToken),new Date(clock().getTime()+ttlSeconds*1000)]);
   if(result.rowCount!==1)throw Error('SESSION_NOT_PERSISTED');
   return {id};
  },
  async get(id){
   if(!valid(id))return null;
   const result=await query(`SELECT user_id,access_token,refresh_token FROM iway_private.auth_server_sessions
    WHERE session_hash=$1 AND expires_at>$2 AND revoked_at IS NULL`,[hash(id),clock()]);
   if(result.rowCount!==1)return null;
   try{return {user_id:result.rows[0].user_id,access_token:cipher.decrypt(result.rows[0].access_token),refresh_token:cipher.decrypt(result.rows[0].refresh_token)};}
   catch{throw Error('SESSION_TOKEN_DECRYPTION_FAILED');}
  },
  async revoke(id){
   if(!valid(id))return false;
   const result=await query(`UPDATE iway_private.auth_server_sessions SET revoked_at=$2
    WHERE session_hash=$1 AND revoked_at IS NULL`,[hash(id),clock()]);
   return result.rowCount===1;
  }
 });
}
