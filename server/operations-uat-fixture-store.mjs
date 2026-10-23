// Durable LOCAL FIXTURE storage only. Never a Vercel/hosted persistence adapter.
// Hosted activation requires a reviewed shared transactional PostgreSQL adapter.
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createUatFixtureStore({db,cipher,fixtureOnly=false,clock=()=>Date.now()}={}){
 if(fixtureOnly!==true||!db?.prepare||!cipher?.encrypt||!cipher?.decrypt)throw Error('UAT_LOCAL_FIXTURE_REQUIRED');
 db.exec(`CREATE TABLE IF NOT EXISTS uat_state(user_id TEXT PRIMARY KEY,version INTEGER NOT NULL DEFAULT 0,ready INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS uat_invites(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,version INTEGER NOT NULL,proof TEXT,expires INTEGER NOT NULL,consumed INTEGER,revoked INTEGER,purpose TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS uat_bindings(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,version INTEGER NOT NULL,method TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS uat_mfa(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,version INTEGER NOT NULL,tokens TEXT,expires INTEGER NOT NULL,consumed INTEGER);
 CREATE TABLE IF NOT EXISTS uat_limits(bucket TEXT PRIMARY KEY,expires INTEGER NOT NULL,count INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS uat_audit(id INTEGER PRIMARY KEY,event TEXT NOT NULL,user_id TEXT,actor_id TEXT,at INTEGER NOT NULL);`);
 function atomic(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch{db.exec('ROLLBACK');throw Error('UAT_STORAGE_UNAVAILABLE');}}
 function audit(event,userId=null,actorId=null){db.prepare('INSERT INTO uat_audit(event,user_id,actor_id,at) VALUES(?,?,?,?)').run(event,userId,actorId,clock());}
 const state=userId=>db.prepare('SELECT * FROM uat_state WHERE user_id=?').get(userId);
 return Object.freeze({
  seed(userId){db.prepare('INSERT INTO uat_state(user_id) VALUES(?) ON CONFLICT DO NOTHING').run(userId);},
  state,
  audit,
  limit(bucket,max,windowMs){return atomic(()=>{
   const now=clock();db.prepare('DELETE FROM uat_limits WHERE expires<=?').run(now);
   db.prepare('INSERT INTO uat_limits VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1').run(hash(bucket),now+windowMs);
   return db.prepare('SELECT count FROM uat_limits WHERE bucket=?').get(hash(bucket)).count<=max;
  });},
  saveInvite({token,userId,proof,expires,purpose,actorId}){return atomic(()=>{
   const current=state(userId);if(!current?.active)throw Error();
   db.prepare('UPDATE uat_state SET version=version+1,ready=0 WHERE user_id=?').run(userId);
   db.prepare('UPDATE uat_invites SET revoked=?,proof=NULL WHERE user_id=? AND consumed IS NULL AND revoked IS NULL').run(clock(),userId);
   const version=state(userId).version;
   db.prepare('INSERT INTO uat_invites(hash,user_id,version,proof,expires,purpose) VALUES(?,?,?,?,?,?)').run(hash(token),userId,version,cipher.encrypt(proof),expires,purpose);
   audit('invitation.issued',userId,actorId);return version;
  });},
  consumeInvite(token){return atomic(()=>{
   const row=db.prepare('SELECT * FROM uat_invites WHERE hash=?').get(hash(token));
   if(!row||row.consumed!==null||row.revoked!==null)return null;
   db.prepare('UPDATE uat_invites SET consumed=?,proof=NULL WHERE hash=?').run(clock(),hash(token));
   if(row.expires<=clock()){audit('invitation.expired',row.user_id);return null;}
   const current=state(row.user_id);if(!current?.active||current.version!==row.version)return null;
   audit('invitation.redeemed',row.user_id);return {...row,proof:cipher.decrypt(row.proof)};
  });},
  activate(userId,version){return atomic(()=>{
   const result=db.prepare('UPDATE uat_state SET ready=1 WHERE user_id=? AND version=? AND active=1').run(userId,version);
   if(result.changes!==1)return false;audit('password.setup.completed',userId);return true;
  });},
  revoke(userId,{deactivate=false,actorId=null}={}){return atomic(()=>{
   db.prepare('UPDATE uat_state SET version=version+1,ready=0,active=CASE WHEN ? THEN 0 ELSE active END WHERE user_id=?').run(deactivate?1:0,userId);
   db.prepare('UPDATE uat_invites SET revoked=?,proof=NULL WHERE user_id=? AND consumed IS NULL AND revoked IS NULL').run(clock(),userId);
   db.prepare('UPDATE uat_mfa SET consumed=?,tokens=NULL WHERE user_id=? AND consumed IS NULL').run(clock(),userId);
   audit('access.revoked',userId,actorId);
  });},
  bind(id,userId,version,method){db.prepare('INSERT INTO uat_bindings VALUES(?,?,?,?)').run(hash(id),userId,version,method);},
  binding(id){return db.prepare('SELECT b.user_id,b.version,b.method FROM uat_bindings b JOIN uat_state s ON s.user_id=b.user_id AND s.version=b.version AND s.active=1 WHERE b.hash=?').get(hash(id));},
  saveMfa(id,userId,version,tokens){db.prepare('INSERT INTO uat_mfa(hash,user_id,version,tokens,expires) VALUES(?,?,?,?,?)').run(hash(id),userId,version,cipher.encrypt(JSON.stringify(tokens)),clock()+300000);},
  consumeMfa(id){return atomic(()=>{
   const row=db.prepare('SELECT * FROM uat_mfa WHERE hash=?').get(hash(id));
   if(!row||row.consumed!==null)return null;
   db.prepare('UPDATE uat_mfa SET consumed=?,tokens=NULL WHERE hash=?').run(clock(),hash(id));
   const current=state(row.user_id);if(row.expires<=clock()||!current?.active||current.version!==row.version)return null;
   return {...row,tokens:JSON.parse(cipher.decrypt(row.tokens))};
  });},
  recoverExpired(){return atomic(()=>{
   const rows=db.prepare('SELECT hash,user_id FROM uat_invites WHERE expires<=? AND consumed IS NULL AND revoked IS NULL').all(clock());
   for(const row of rows){db.prepare('UPDATE uat_invites SET consumed=?,proof=NULL WHERE hash=?').run(clock(),row.hash);audit('invitation.expired',row.user_id);}
   db.prepare('UPDATE uat_mfa SET consumed=?,tokens=NULL WHERE expires<=? AND consumed IS NULL').run(clock(),clock());
   db.prepare('DELETE FROM uat_limits WHERE expires<=?').run(clock());return rows.length;
  });}
 });
}
