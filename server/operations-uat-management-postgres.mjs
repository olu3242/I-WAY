// Separate management metadata identity. No Auth administration or mail credentials.
import {randomUUID} from 'node:crypto';
import {postgresTlsOptions} from './postgres-tls.mjs';
const role='iway_uat_management_runtime';
// Explicit server-owned input for the separate management process, never a Preview key.
export function resolveUatManagementDatabaseConfig(databaseUrl){
 try{
  const u=new URL(databaseUrl),project='vnoxdinldneeczxibicp',direct=u.hostname==='db.'+project+'.supabase.co';
  if(!['postgres:','postgresql:'].includes(u.protocol)||!direct&&!/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)||u.port!=='5432'||u.pathname!=='/postgres'||u.search||u.hash||decodeURIComponent(u.username)!==(direct?role:role+'.'+project)||decodeURIComponent(u.password).length<12)throw Error();
  return {host:u.hostname,port:5432,database:'postgres',user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),ssl:postgresTlsOptions(u.hostname),max:2,connectionTimeoutMillis:8000,statement_timeout:3000,query_timeout:4000,application_name:'iway-uat-management'};
 }catch{throw Error('UAT_MANAGEMENT_DATABASE_REJECTED');}
}
export async function assertUatManagementRuntime(pool){
 try{
  const r=(await pool.query(`SELECT session_user,current_user,rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreaterole,rolcreatedb,rolreplication,
   EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS membership,
   EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (n.nspowner=r.oid OR has_schema_privilege(r.oid,n.oid,'CREATE'))) AS ddl,
   EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relowner=r.oid) AS owns
   FROM pg_roles r WHERE rolname=current_user`)).rows[0];
  if(r?.session_user!==role||r.current_user!==role||r.rolcanlogin!==true||['rolsuper','rolbypassrls','rolinherit','rolcreaterole','rolcreatedb','rolreplication','membership','ddl','owns'].some(k=>r[k]!==false))throw Error();
  const tls=(await pool.query('SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];
  if(tls?.ssl!==true||!['TLSv1.2','TLSv1.3'].includes(tls.version))throw Error();
  const rows=(await pool.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
   has_table_privilege(c.oid,'SELECT') AS s,has_table_privilege(c.oid,'INSERT') AS i,has_table_privilege(c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS extra
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_management_private' AND c.relkind IN ('r','p')`)).rows;
  if(rows.length!==2||rows.some(r=>!['commands','audit'].includes(r.relname)||!r.relrowsecurity||!r.relforcerowsecurity||r.extra||!r.i||r.s!==(r.relname==='commands')))throw Error();
  const columns=(await pool.query("SELECT c.relname,a.attname,has_column_privilege(c.oid,a.attname,'SELECT') AS s,has_column_privilege(c.oid,a.attname,'INSERT') AS i,has_column_privilege(c.oid,a.attname,'UPDATE') AS u,has_column_privilege(c.oid,a.attname,'REFERENCES') AS r FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_management_private' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped")).rows;
  if(columns.some(r=>r.s!==(r.relname==='commands')||!r.i||r.u!==(r.relname==='commands'&&['status','finished'].includes(r.attname))||r.r))throw Error();
  const policies=(await pool.query("SELECT c.relname,p.polname,p.polcmd,p.polpermissive,ARRAY(SELECT rolname::text FROM pg_roles WHERE oid=ANY(p.polroles)) AS roles,pg_get_expr(p.polqual,p.polrelid) AS qual,pg_get_expr(p.polwithcheck,p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_uat_management_private'")).rows;
  const expression=value=>value?.replace(/\s|[()]|::text/g,'');
  const predicate="actor_id=current_setting'iway.management_actor',true";
  if(policies.length!==2||policies.some(p=>!p.polpermissive||JSON.stringify(p.roles)!==JSON.stringify([role])||(p.relname==='commands'?(p.polname!=='management_commands'||p.polcmd!=='*'||expression(p.qual)!==predicate||expression(p.check)!==predicate):(p.relname!=='audit'||p.polname!=='management_audit'||p.polcmd!=='a'||p.qual!==null||expression(p.check)!==predicate))))throw Error();
  const triggers=(await pool.query("SELECT c.relname,t.tgname,t.tgenabled,p.prosecdef,p.proname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid WHERE n.nspname='iway_uat_management_private' AND NOT t.tgisinternal")).rows;
  if(triggers.length!==2||triggers.some(t=>t.tgenabled!=='O'||t.prosecdef||(t.relname==='commands'?(t.tgname!=='command_terminal'||t.proname!=='terminal_command'):(t.relname!=='audit'||t.tgname!=='audit_immutable'||t.proname!=='immutable_audit'))))throw Error();
  const extra=await pool.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND (n.nspname<>'iway_uat_management_private' OR c.relname NOT IN ('commands','audit')) AND c.relkind IN ('r','p','v','m','f') AND has_schema_privilege(n.oid,'USAGE') AND (has_table_privilege(c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(c.oid,'SELECT,INSERT,UPDATE,REFERENCES')) LIMIT 1`);
  if(extra.rowCount)throw Error();
  const definers=await pool.query("SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND has_schema_privilege(n.oid,'USAGE') AND has_function_privilege(p.oid,'EXECUTE') LIMIT 1");
  if(definers.rowCount)throw Error();return true;
 }catch{throw Error('UAT_MANAGEMENT_RUNTIME_REJECTED');}
}
export function createUatManagementPostgresStore({pool}={}){
 let ready;const ensure=()=>ready??=assertUatManagementRuntime(pool);
 async function atomic(actorId,fn){
  await ensure();const c=await pool.connect();
  try{if(c.connection?.stream?.encrypted!==true||c.connection.stream.authorized!==true||c.connectionParameters.ssl?.rejectUnauthorized!==true)throw Error();await c.query('BEGIN');await c.query("SELECT set_config('iway.management_actor',$1,true)",[actorId]);const result=await fn(c);await c.query('COMMIT');return result;}
  catch{await c.query('ROLLBACK').catch(()=>{});throw Error('UAT_MANAGEMENT_STORAGE_UNAVAILABLE');}finally{c.release();}
 }
 const audit=(c,event,row,now)=>c.query('INSERT INTO iway_uat_management_private.audit(id,actor_id,user_id,event,command_hash,at) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),row.actor_id,row.user_id,event,row.key,now]);
 async function finish({key,nonce,actorId,now},status){return atomic(actorId,async c=>{
  const row=(await c.query("UPDATE iway_uat_management_private.commands SET status=$3,finished=$4 WHERE key=$1 AND nonce=$2 AND status='claimed' RETURNING *",[key,nonce,status,now])).rows[0];
  if(!row)return false;await audit(c,'command.'+status,row,now);return true;
 });}
 return Object.freeze({
  async claim({key,fingerprint,actorId,userId,nonce,expires,now}){return atomic(actorId,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,710))',[userId]);
   const old=(await c.query('SELECT * FROM iway_uat_management_private.commands WHERE key=$1 FOR UPDATE',[key])).rows[0];
   if(old){
    if(old.fingerprint!==fingerprint)return {status:'conflict'};
    if(old.status==='claimed'&&Number(old.expires)<=now){await c.query("UPDATE iway_uat_management_private.commands SET status='uncertain',finished=$2 WHERE key=$1",[key,now]);await audit(c,'command.uncertain',old,now);}
    return {status:old.status==='completed'?'completed':'fenced'};
   }
   const result=await c.query("INSERT INTO iway_uat_management_private.commands(key,fingerprint,actor_id,user_id,nonce,expires,created,status) VALUES($1,$2,$3,$4,$5,$6,$7,'claimed') ON CONFLICT DO NOTHING RETURNING *",[key,fingerprint,actorId,userId,nonce,expires,now]);
   const row=result.rows[0];if(!row)return {status:'fenced'};
   await audit(c,'command.claimed',row,now);return {status:'claimed',nonce,expires};
  });},
  complete:args=>finish(args,'completed'),uncertain:args=>finish(args,'uncertain')
 });
}
