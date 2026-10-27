// Stable opaque browser handle; provider tokens rotate under a persistent single-writer claim.
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const hash=id=>createHash('sha256').update(id).digest('hex');
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{40,128}$/.test(id);
const uuid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function createPostgresOpaqueSessionStore({query,cipher,clock=()=>new Date()}={}){
 if(typeof query!=='function'||typeof cipher?.encrypt!=='function'||typeof cipher?.decrypt!=='function')throw Error('SESSION_STORE_SECURE_DEPENDENCIES_REQUIRED');
 async function revoke(id){
  if(!valid(id))return false;
  const result=await query(`UPDATE iway_private.auth_server_sessions SET revoked_at=$2,
   access_token=NULL,refresh_token=NULL,refresh_claim=NULL,refresh_started_at=NULL
   WHERE session_hash=$1 AND revoked_at IS NULL`,[hash(id),clock()]);
  return result.rowCount===1;
 }
 return Object.freeze({
  async create({userId,accessToken,refreshToken,ttlSeconds=3600,accessExpiresAt}={}){
   const now=clock(),expiry=new Date(now.getTime()+ttlSeconds*1000);
   const accessExpiry=accessExpiresAt===undefined?expiry:new Date(accessExpiresAt);
   if(!uuid(userId)||typeof accessToken!=='string'||!accessToken||typeof refreshToken!=='string'||!refreshToken||
    !Number.isInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600||!Number.isFinite(accessExpiry.getTime())||accessExpiry<=now)
    throw Error('SESSION_INVALID');
   const id=randomBytes(32).toString('base64url');
   const result=await query(`INSERT INTO iway_private.auth_server_sessions
    (session_hash,user_id,access_token,refresh_token,expires_at,access_expires_at)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING session_hash`,
    [hash(id),userId,cipher.encrypt(accessToken),cipher.encrypt(refreshToken),expiry,accessExpiry]);
   if(result.rowCount!==1)throw Error('SESSION_NOT_PERSISTED');
   return {id};
  },
  async get(id){
   if(!valid(id))return null;
   const result=await query(`SELECT user_id,access_token,refresh_token,expires_at FROM iway_private.auth_server_sessions
    WHERE session_hash=$1 AND expires_at>$2 AND access_expires_at>$2 AND revoked_at IS NULL AND refresh_claim IS NULL`,[hash(id),clock()]);
   if(result.rowCount!==1)return null;
   try{return {user_id:result.rows[0].user_id,access_token:cipher.decrypt(result.rows[0].access_token),refresh_token:cipher.decrypt(result.rows[0].refresh_token)};}
   catch{throw Error('SESSION_TOKEN_DECRYPTION_FAILED');}
  },
  async getForRefresh(id){
   if(!valid(id))return null;
   // A refresh preflight grants no resource access and never returns old tokens.
   // The atomic refresh claim below still enforces absolute expiry/revocation.
   const result=await query(`SELECT user_id FROM iway_private.auth_server_sessions
    WHERE session_hash=$1 AND expires_at>$2 AND revoked_at IS NULL AND refresh_claim IS NULL`,[hash(id),clock()]);
   return result.rowCount===1?{user_id:result.rows[0].user_id}:null;
  },
  revoke,
  async refresh(id,refreshTokens){
   if(!valid(id)||typeof refreshTokens!=='function')return null;
   const claim=randomUUID(),now=clock();
   const result=await query(`UPDATE iway_private.auth_server_sessions SET refresh_claim=$3,refresh_started_at=$2
    WHERE session_hash=$1 AND expires_at>$2 AND revoked_at IS NULL AND refresh_claim IS NULL
    RETURNING user_id,refresh_token,expires_at`,[hash(id),now,claim]);
   if(result.rowCount!==1)return null;
   try{
    const row=result.rows[0],tokens=await refreshTokens(cipher.decrypt(row.refresh_token));
    const finished=clock(),expiry=new Date(tokens?.accessExpiresAt);
    if(tokens?.user?.id!==row.user_id||!tokens?.accessToken||!tokens?.refreshToken||!Number.isFinite(expiry.getTime())||expiry<=finished)
     throw Error('SESSION_REFRESH_INVALID');
    const updated=await query(`UPDATE iway_private.auth_server_sessions SET access_token=$3,refresh_token=$4,
     access_expires_at=$5,refresh_claim=NULL,refresh_started_at=NULL,token_version=token_version+1
     WHERE session_hash=$1 AND refresh_claim=$2 AND revoked_at IS NULL AND expires_at>$6
      AND refresh_started_at>$7 RETURNING expires_at`,
     [hash(id),claim,cipher.encrypt(tokens.accessToken),cipher.encrypt(tokens.refreshToken),expiry,finished,new Date(finished.getTime()-30000)]);
    if(updated.rowCount!==1)throw Error('SESSION_REFRESH_LOST');
    return {id,maxAge:Math.max(1,Math.floor((new Date(updated.rows[0].expires_at)-finished)/1000))};
   }catch{
    // Never replay a refresh token after an uncertain provider/database outcome.
    await revoke(id).catch(()=>{});
    throw Error('SESSION_REFRESH_FAILED');
   }
  },
  async recoverStale(){
   const now=clock();
   const result=await query(`UPDATE iway_private.auth_server_sessions SET revoked_at=$1,
    access_token=NULL,refresh_token=NULL,refresh_claim=NULL,refresh_started_at=NULL
    WHERE revoked_at IS NULL AND (expires_at<=$1 OR (refresh_claim IS NOT NULL AND refresh_started_at<=$2))`,
    [now,new Date(now.getTime()-30000)]);
   return result.rowCount;
  }
 });
}
