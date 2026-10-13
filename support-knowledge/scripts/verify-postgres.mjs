// B15 read-only real PostgreSQL/RLS certification probe. Never uses hosted credentials by default.
// Run only against an explicitly selected disposable isolated PostgreSQL database.
import {Pool} from 'pg';
import {withSopTransaction} from '../transaction-context.mjs';
const url=process.env.IWAY_SOP_ISOLATED_DATABASE_URL;
if(!url||process.env.IWAY_SOP_ISOLATED_CONFIRM!=='YES'){console.error('BLOCKED: isolated DB URL and explicit confirmation required');process.exitCode=2}
else{
 const pool=new Pool({connectionString:url,max:1});
 const identity={verified:true,tenantMembershipVerified:true,subjectId:'cert_actor',tenantId:'cert_tenant',role:'driver'};
 try{
  const check=await withSopTransaction(pool,identity,async client=>{
   const who=await client.query("SELECT current_user AS username, current_setting('iway.verified_tenant',true) AS tenant, current_setting('iway.verified_actor',true) AS actor");
   const role=await client.query("SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user");
   if(role.rowCount!==1||role.rows[0].rolbypassrls||role.rows[0].rolsuper)throw Error('PRIVILEGED_DB_ROLE');
   const owner=await client.query("SELECT count(*)::int AS owned FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iway_private' AND c.relname LIKE 'sop_%' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)");
   if(owner.rows[0].owned!==0)throw Error('OWNER_ROLE_UNSAFE');
   const policies=await client.query("SELECT tablename,rowsecurity,forcerowsecurity FROM pg_tables WHERE schemaname='iway_private' AND tablename IN ('sop_articles','sop_tickets','sop_ticket_events')");
   if(policies.rowCount!==3||policies.rows.some(x=>!x.rowsecurity||!x.forcerowsecurity))throw Error('RLS_NOT_ENFORCED');
   const articles=await client.query('SELECT count(*)::int AS n FROM iway_private.sop_articles WHERE tenant_id=$1',['cert_tenant']);
   const tickets=await client.query('SELECT count(*)::int AS n FROM iway_private.sop_tickets WHERE tenant_id=$1',['cert_tenant']);
   if(who.rows[0].tenant!=='cert_tenant'||who.rows[0].actor!=='cert_actor')throw Error('CONTEXT_NOT_BOUND');
   return {role:who.rows[0].username,rlsTables:policies.rowCount,visibleArticles:articles.rows[0].n,visibleTickets:tickets.rows[0].n};
  });
  console.log(JSON.stringify({status:'PASS',scope:'isolated-read-only-rls-smoke',...check}));
 }catch(e){console.error(JSON.stringify({status:'FAIL',scope:'isolated-read-only-rls-smoke',code:e.message}));process.exitCode=1}
 finally{await pool.end()}
}
