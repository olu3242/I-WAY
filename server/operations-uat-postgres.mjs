// Candidate shared broker persistence. Never provisions users, roles or schema.
// Admin-only seeding and live schema application remain approval gated.
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
export async function assertUatPostgresRuntime(pool){
 const fail=()=>{throw Error('UAT_RUNTIME_PRIVILEGES_INVALID');};
 try{
  const identity=(await pool.query(`SELECT session_user,current_user,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolinherit,r.rolcanlogin,
   EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles administrator ON administrator.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE m.member=r.oid OR (m.roleid=r.oid AND NOT (administrator.rolname='postgres' AND administrator.rolcreaterole AND grantor.oid=10 AND grantor.rolsuper AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option))) AS memberships,
   EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (n.nspowner=r.oid OR has_schema_privilege(r.oid,n.oid,'CREATE'))) AS schema_ddl,
   EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relowner=r.oid) AS owns_relation
   FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  if(identity?.session_user!=='iway_uat_runtime'||identity?.current_user!=='iway_uat_runtime'||identity.rolcanlogin!==true||['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','rolinherit','memberships','schema_ddl','owns_relation'].some(k=>identity[k]!==false))fail();
  const rows=(await pool.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege(c.oid,'SELECT') AS s,has_table_privilege(c.oid,'INSERT') AS i,has_table_privilege(c.oid,'UPDATE') AS u,has_table_privilege(c.oid,'DELETE') AS d,has_table_privilege(c.oid,'TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(c.oid,'REFERENCES') AS extra,
   has_any_column_privilege(c.oid,'SELECT') AS cs,has_any_column_privilege(c.oid,'INSERT') AS ci,has_any_column_privilege(c.oid,'UPDATE') AS cu
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_private' AND c.relkind IN ('r','p')`)).rows;
  const grants={state:[true,false,false,false],invites:[true,true,true,false],bindings:[true,true,false,false],mfa:[true,true,true,false],limits:[true,true,true,true],audit:[false,true,false,false]};
  if(rows.length!==6||rows.some(r=>!grants[r.relname]||!r.relrowsecurity||!r.relforcerowsecurity||r.extra||['s','i','u','d'].some((k,i)=>r[k]!==grants[r.relname][i])||r.cs!==r.s||r.ci!==r.i||r.cu!==(r.relname==='state'||r.u)))fail();
  const columns=(await pool.query("SELECT attname,has_column_privilege('iway_uat_private.state',attname,'UPDATE') AS writable FROM pg_attribute WHERE attrelid='iway_uat_private.state'::regclass AND attnum>0 AND NOT attisdropped")).rows;
  if(columns.some(c=>c.writable!==['version','ready','active'].includes(c.attname)))fail();
  const exposure=await pool.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (n.nspname<>'iway_uat_private' OR c.relname NOT IN ('state','invites','bindings','mfa','limits','audit')) AND c.relkind IN ('r','p','v','m','f')
   AND has_schema_privilege(n.oid,'USAGE') AND (has_table_privilege(c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) LIMIT 1`);
  if(exposure.rowCount)fail();
  const definers=await pool.query("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_schema_privilege(n.oid,'USAGE') AND has_function_privilege(p.oid,'EXECUTE') LIMIT 1");
  if(definers.rowCount)fail();return true;
 }catch{fail();}
}
export function createUatPostgresStore({pool,cipher,clock=()=>Date.now()}={}){
 if(!pool?.connect||!cipher?.encrypt||!cipher?.decrypt)throw Error('UAT_POSTGRES_DEPENDENCIES_REQUIRED');
 let ready;const ensure=()=>ready??=assertUatPostgresRuntime(pool);
 const sql=async(text,args)=>{await ensure();return pool.query(text,args);};
 async function atomic(fn){await ensure();const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client.query.bind(client));await client.query('COMMIT');return result;}catch{await client.query('ROLLBACK').catch(()=>{});throw Error('UAT_STORAGE_UNAVAILABLE');}finally{client.release();}}
 const state=async userId=>(await sql('SELECT * FROM iway_uat_private.state WHERE user_id=$1',[userId])).rows[0];
 const audit=(event,userId=null,actorId=null,query=sql)=>query('INSERT INTO iway_uat_private.audit(event,user_id,actor_id,at) VALUES($1,$2,$3,$4)',[event,userId,actorId,clock()]);
 return Object.freeze({
  state,audit,
  async limit(bucket,max,windowMs){return atomic(async q=>{
   const now=clock();const result=await q(`INSERT INTO iway_uat_private.limits(bucket,expires,count) VALUES($1,$2,1)
    ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN limits.expires<=$3 THEN 1 ELSE limits.count+1 END,
    expires=CASE WHEN limits.expires<=$3 THEN $2 ELSE limits.expires END RETURNING count`,[hash(bucket),now+windowMs,now]);return result.rows[0].count<=max;
  });},
  async saveInvite({token,userId,proof,expires,purpose,actorId}){return atomic(async q=>{
   const updated=await q('UPDATE iway_uat_private.state SET version=version+1,ready=false WHERE user_id=$1 AND active RETURNING version',[userId]);if(updated.rowCount!==1)throw Error();
   const version=updated.rows[0].version;
   await q('UPDATE iway_uat_private.invites SET revoked=$2,proof=NULL WHERE user_id=$1 AND consumed IS NULL AND revoked IS NULL',[userId,clock()]);
   await q('INSERT INTO iway_uat_private.invites(hash,user_id,version,proof,expires,purpose) VALUES($1,$2,$3,$4,$5,$6)',[hash(token),userId,version,cipher.encrypt(proof),expires,purpose]);
   await audit('invitation.issued',userId,actorId,q);return version;
  });},
  async consumeInvite(token){return atomic(async q=>{
   const result=await q('SELECT * FROM iway_uat_private.invites WHERE hash=$1 FOR UPDATE',[hash(token)]),row=result.rows[0];if(!row||row.consumed!==null||row.revoked!==null)return null;
   await q('UPDATE iway_uat_private.invites SET consumed=$2,proof=NULL WHERE hash=$1',[hash(token),clock()]);
   if(Number(row.expires)<=clock()){await audit('invitation.expired',row.user_id,null,q);return null;}
   const current=(await q('SELECT * FROM iway_uat_private.state WHERE user_id=$1',[row.user_id])).rows[0];if(!current?.active||current.version!==row.version)return null;
   await audit('invitation.redeemed',row.user_id,null,q);return {...row,proof:cipher.decrypt(row.proof)};
  });},
  async activate(userId,version){return atomic(async q=>{
   const result=await q('UPDATE iway_uat_private.state SET ready=true WHERE user_id=$1 AND version=$2 AND active',[userId,version]);if(result.rowCount!==1)return false;
   await audit('password.setup.completed',userId,null,q);return true;
  });},
  async revoke(userId,{deactivate=false,actorId=null}={}){return atomic(async q=>{
   await q('UPDATE iway_uat_private.state SET version=version+1,ready=false,active=CASE WHEN $2 THEN false ELSE active END WHERE user_id=$1',[userId,deactivate]);
   await q('UPDATE iway_uat_private.invites SET revoked=$2,proof=NULL WHERE user_id=$1 AND consumed IS NULL AND revoked IS NULL',[userId,clock()]);
   await q('UPDATE iway_uat_private.mfa SET consumed=$2,tokens=NULL WHERE user_id=$1 AND consumed IS NULL',[userId,clock()]);
   await audit('access.revoked',userId,actorId,q);
  });},
  bind:(id,userId,version,method)=>sql('INSERT INTO iway_uat_private.bindings VALUES($1,$2,$3,$4)',[hash(id),userId,version,method]),
  binding:async id=>(await sql('SELECT b.user_id,b.version,b.method FROM iway_uat_private.bindings b JOIN iway_uat_private.state s ON s.user_id=b.user_id AND s.version=b.version AND s.active WHERE b.hash=$1',[hash(id)])).rows[0],
  saveMfa:(id,userId,version,tokens)=>sql('INSERT INTO iway_uat_private.mfa(hash,user_id,version,tokens,expires) VALUES($1,$2,$3,$4,$5)',[hash(id),userId,version,cipher.encrypt(JSON.stringify(tokens)),clock()+300000]),
  async consumeMfa(id){return atomic(async q=>{
   const row=(await q('SELECT * FROM iway_uat_private.mfa WHERE hash=$1 FOR UPDATE',[hash(id)])).rows[0];if(!row||row.consumed!==null)return null;
   await q('UPDATE iway_uat_private.mfa SET consumed=$2,tokens=NULL WHERE hash=$1',[hash(id),clock()]);
   const current=(await q('SELECT * FROM iway_uat_private.state WHERE user_id=$1',[row.user_id])).rows[0];if(Number(row.expires)<=clock()||!current?.active||current.version!==row.version)return null;
   return {...row,tokens:JSON.parse(cipher.decrypt(row.tokens))};
  });},
  async recoverExpired(){return atomic(async q=>{
   const rows=(await q('UPDATE iway_uat_private.invites SET consumed=$1,proof=NULL WHERE expires<=$1 AND consumed IS NULL AND revoked IS NULL RETURNING user_id',[clock()])).rows;
   for(const row of rows)await audit('invitation.expired',row.user_id,null,q);
   await q('UPDATE iway_uat_private.mfa SET consumed=$1,tokens=NULL WHERE expires<=$1 AND consumed IS NULL',[clock()]);
   await q('DELETE FROM iway_uat_private.limits WHERE expires<=$1',[clock()]);return rows.length;
  });}
 });
}
