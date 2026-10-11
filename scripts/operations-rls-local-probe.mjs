// B61: opt-in, read-only PostgreSQL RLS probe. Never runs against a hosted endpoint.
// Requires a separately provisioned local PostgreSQL instance, restricted application
// role, applied operations schema, and two existing isolated fixture tenants.
// No migrations, grants, credentials, or fixture records are created by this script.
import {Pool} from 'pg';
import {isIP} from 'node:net';
const fail=(reason)=>{console.error(JSON.stringify({status:'BLOCKED',gate:'B61_POSTGRES_RLS',reason}));process.exitCode=1;};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const urlString=process.env.IWAY_B61_LOCAL_DATABASE_URL;
const tenantA=process.env.IWAY_B61_TENANT_A,tenantB=process.env.IWAY_B61_TENANT_B;
const actorA=process.env.IWAY_B61_ACTOR_A,actorB=process.env.IWAY_B61_ACTOR_B;
let url;
try{url=new URL(urlString)}catch{}
if(!url||!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname)||!['5432','5433'].includes(url.port)||url.search||url.hash||!url.password||!url.username||/^(postgres|supabase_admin|service_role)$/i.test(decodeURIComponent(url.username))||![tenantA,tenantB,actorA,actorB].every(uuid)||tenantA===tenantB||actorA===actorB){
 fail('LOCAL_RESTRICTED_ROLE_AND_TWO_FIXTURE_SCOPES_REQUIRED');
}else{
 const pool=new Pool({connectionString:urlString,max:1,connectionTimeoutMillis:3000,statement_timeout:5000});
 try{
  const client=await pool.connect();
  try{
   const identity=await client.query("SELECT current_user AS login, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_private' AND pg_catalog.pg_has_role(current_user,c.relowner,'MEMBER')) AS owner_member FROM pg_catalog.pg_roles r WHERE r.rolname=current_user");
   const role=identity.rows[0];
   if(!role||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb||role.owner_member)throw Error('RESTRICTED_ROLE_REQUIRED');
   const results=[];
   for(const [tenant,actor,foreign] of [[tenantA,actorA,tenantB],[tenantB,actorB,tenantA]]){
    await client.query('BEGIN READ ONLY');
    try{
     await client.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true)",[tenant,actor]);
     const own=await client.query("SELECT id FROM operations_private.users WHERE tenant_id=$1 AND id=$2 AND data->>'active'='true'",[tenant,actor]);
     if(own.rowCount!==1)throw Error('FIXTURE_PRINCIPAL_MISSING');
     const cross=await client.query('SELECT id FROM operations_private.users WHERE tenant_id=$1 LIMIT 1',[foreign]);
     if(cross.rowCount!==0)throw Error('CROSS_TENANT_RLS_LEAK');
     const visible=await client.query('SELECT COUNT(*)::int AS n FROM operations_private.resources WHERE tenant_id=$1',[foreign]);
     if(visible.rows[0]?.n!==0)throw Error('CROSS_TENANT_RESOURCES_LEAK');
     results.push({scope:'fixture_'+(results.length+1),foreignUsers:cross.rowCount,foreignResources:visible.rows[0].n});
    }finally{await client.query('ROLLBACK');}
   }
   console.log(JSON.stringify({status:'PASS',gate:'B61_POSTGRES_RLS',environment:'LOCAL_ONLY',readOnly:true,scopes:results,hostedCertified:false}));
  }finally{client.release();}
 }catch(e){fail(['RESTRICTED_ROLE_REQUIRED','FIXTURE_PRINCIPAL_MISSING','CROSS_TENANT_RLS_LEAK','CROSS_TENANT_RESOURCES_LEAK'].includes(e.message)?e.message:'LOCAL_POSTGRES_EXECUTION_FAILED');}
 finally{await pool.end();}
}
