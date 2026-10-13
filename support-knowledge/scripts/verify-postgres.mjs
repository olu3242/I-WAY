// B16 isolated read-only PostgreSQL RLS smoke probe. No hosted or privileged DB connections.
import {Pool} from 'pg';
import {withSopTransaction} from '../transaction-context.mjs';

const raw=process.env.IWAY_SOP_ISOLATED_DATABASE_URL;
const confirmed=process.env.IWAY_SOP_ISOLATED_CONFIRM==='YES';
let target;
try{
 if(!confirmed||!raw)throw Error('ISOLATED_DATABASE_CONFIRMATION_REQUIRED');
 target=new URL(raw);
 if(!['postgres:','postgresql:'].includes(target.protocol))throw Error('INVALID_DATABASE_PROTOCOL');
 if(!['127.0.0.1','localhost','::1','[::1]'].includes(target.hostname))throw Error('NONLOCAL_DATABASE_DENIED');
 if(target.port!=='55432'||target.pathname!=='/iway_sop_cert')throw Error('UNEXPECTED_DATABASE_TARGET');
 if(target.username!=='iway_sop_cert')throw Error('RESTRICTED_LOGIN_REQUIRED');
 if(!target.password)throw Error('DATABASE_PASSWORD_REQUIRED');
}catch(error){
 console.error(JSON.stringify({status:'BLOCKED',scope:'isolated-read-only-rls-smoke',code:error.message}));
 process.exitCode=2;
}
if(target){
 const pool=new Pool({connectionString:raw,max:1});
 const identity={verified:true,tenantMembershipVerified:true,subjectId:'cert_actor',tenantId:'cert_tenant',role:'driver'};
 try{
  const check=await withSopTransaction(pool,identity,async client=>{
   const login=await client.query("SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user");
   if(login.rowCount!==1||login.rows[0].name!=='iway_sop_cert'||login.rows[0].rolsuper||login.rows[0].rolbypassrls)throw Error('UNSAFE_LOGIN_ROLE');
   await client.query('SET LOCAL ROLE iway_sop_runtime');
   const who=await client.query("SELECT current_user AS username,current_setting('iway.verified_tenant',true) AS tenant,current_setting('iway.verified_actor',true) AS actor");
   if(who.rows[0].username!=='iway_sop_runtime'||who.rows[0].tenant!=='cert_tenant'||who.rows[0].actor!=='cert_actor')throw Error('RUNTIME_CONTEXT_INVALID');
   const role=await client.query("SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user");
   if(role.rowCount!==1||role.rows[0].rolbypassrls||role.rows[0].rolsuper)throw Error('PRIVILEGED_RUNTIME_ROLE');
   const owner=await client.query("SELECT count(*)::int AS owned FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relname LIKE 'sop_%' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)");
   if(owner.rows[0].owned!==0)throw Error('OWNER_ROLE_UNSAFE');
   const policies=await client.query("SELECT c.relname,c.relrowsecurity AS rowsecurity,c.relforcerowsecurity AS forcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relname IN ('sop_articles','sop_tickets','sop_ticket_events')");
   if(policies.rowCount!==3||policies.rows.some(x=>!x.rowsecurity||!x.forcerowsecurity))throw Error('RLS_NOT_ENFORCED');
   const articles=await client.query('SELECT count(*)::int AS n FROM iway_private.sop_articles WHERE tenant_id=$1',['cert_tenant']);
   const tickets=await client.query('SELECT count(*)::int AS n FROM iway_private.sop_tickets WHERE tenant_id=$1',['cert_tenant']);
   return {login:'iway_sop_cert',role:who.rows[0].username,rlsTables:policies.rowCount,visibleArticles:articles.rows[0].n,visibleTickets:tickets.rows[0].n};
  });
  console.log(JSON.stringify({status:'PASS',scope:'isolated-read-only-rls-smoke',...check}));
 }catch(error){console.error(JSON.stringify({status:'FAIL',scope:'isolated-read-only-rls-smoke',code:error.code||error.message}));process.exitCode=1}
 finally{await pool.end()}
}
