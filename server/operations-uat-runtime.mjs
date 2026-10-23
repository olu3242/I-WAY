// Reviewed candidate assembly only. The deployed entrypoint does not import this.
// No auto-enable, schema creation, account provisioning, linking or mail setup.
import {resolveAuthRuntimeConfig} from './operations-auth-runtime.mjs';
import {assertAuthDatabaseReady} from './operations-auth-database-check.mjs';
import {postgresTlsOptions} from './postgres-tls.mjs';
import {createConfiguredSessionCipher} from './operations-supabase-session-config.experimental.mjs';
import {createPostgresOpaqueSessionStore} from './operations-supabase-opaque-session-store.experimental.mjs';
import {createPostgresPkceTransactionStore} from './operations-supabase-pkce-postgres-store.experimental.mjs';
import {createSupabaseProvider} from './operations-supabase-provider.mjs';
import {createPrivateResourceAuthorizer} from './operations-auth-authorization.mjs';
import {createUatPostgresStore,assertUatPostgresRuntime} from './operations-uat-postgres.mjs';
import {createUatSupabaseProvider} from './operations-uat-provider.mjs';
import {createUatWorkflow,validateUatRoster} from './operations-uat-workflow.mjs';
import {createUatCandidateHttp} from './operations-uat-http.mjs';
export function resolveUatRuntimeConfig(env){
 const auth=resolveAuthRuntimeConfig(env);
 if(env.IWAY_UAT_ENABLED!=='true'||env.IWAY_UAT_SCHEMA_APPROVED!=='b574-candidate-v1'||env.IWAY_AUTH_PROVIDER!=='google')throw Error('UAT_ACTIVATION_NOT_APPROVED');
 let url;try{url=new URL(env.IWAY_UAT_DATABASE_URL);}catch{throw Error('UAT_DATABASE_TARGET_INVALID');}
 const direct=url.hostname==='db.vnoxdinldneeczxibicp.supabase.co',pooled=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
 const user=decodeURIComponent(url.username);
 if(!['postgres:','postgresql:'].includes(url.protocol)||(!direct&&!pooled)||user!==(direct?'iway_uat_runtime':'iway_uat_runtime.vnoxdinldneeczxibicp')||url.pathname!=='/postgres'||!url.password||url.search||url.hash||!['','5432'].includes(url.port))throw Error('UAT_DATABASE_TARGET_INVALID');
 return {auth,broker:{host:url.hostname,port:5432,database:'postgres',user,password:decodeURIComponent(url.password),ssl:postgresTlsOptions(url.hostname),max:4,connectionTimeoutMillis:2000,statement_timeout:3000,query_timeout:4000,application_name:'iway-uat-staging'}};
}
export async function createUatCandidateRuntime({env=process.env,roster,verifier,authenticateAdministrator,authorizeIssuance,issuer,deliver,controlPlaneMembership,verifyRelationships,PoolClass,fetchImpl=fetch}={}){
 const entries=validateUatRoster(roster);
 if(![authenticateAdministrator,authorizeIssuance,issuer?.generateRecovery,deliver,controlPlaneMembership,verifyRelationships].every(f=>typeof f==='function')||!verifier)throw Error('UAT_HOSTED_BINDINGS_REQUIRED');
 const config=resolveUatRuntimeConfig(env),cipher=createConfiguredSessionCipher(env),Pool=PoolClass??(await import('pg')).Pool;
 const authPool=new Pool(config.auth.db),brokerPool=new Pool(config.broker);
 authPool.on('error',()=>{});brokerPool.on('error',()=>{});
 try{
  await assertAuthDatabaseReady({query:(sql,args)=>authPool.query(sql,args)});await assertUatPostgresRuntime(brokerPool);
  const store=createUatPostgresStore({pool:brokerPool,cipher}),sessions=createPostgresOpaqueSessionStore({query:(sql,args)=>authPool.query(sql,args),cipher});
  const transactions=createPostgresPkceTransactionStore({query:(sql,args)=>authPool.query(sql,args),cipher});
  const provider=createUatSupabaseProvider({apiKey:config.auth.apiKey,verifier,fetchImpl});
  const googleProvider=createSupabaseProvider({url:'https://vnoxdinldneeczxibicp.supabase.co',apiKey:config.auth.apiKey,provider:'google',redirectTo:config.auth.origin+'/auth/callback',fetchImpl});
  const authorize=createPrivateResourceAuthorizer({pool:authPool});
  async function lookupMembership(userId){
   const entry=entries.find(e=>e.userId===userId);if(!entry||!await verifyRelationships(entry))return null;
   if(entry.role==='platform')return controlPlaneMembership(userId);
   const client=await authPool.connect();try{
    await client.query('BEGIN READ ONLY');await client.query("SELECT set_config('iway.user_id',$1,true)",[userId]);
    const rows=(await client.query('SELECT m.*,t.active AS tenant_active FROM iway_private.auth_tenant_roles m JOIN iway_private.auth_tenants t USING(tenant_id) WHERE m.user_id=$1 AND m.active AND m.revoked_at IS NULL',[userId])).rows;
    await client.query('COMMIT');if(rows.length!==1)return null;const row=rows[0];
    return {active:row.active,revoked:!!row.revoked_at,role:row.role,tenantId:row.tenant_id,fleetId:row.fleet_id,principalId:row.principal_id,permissions:row.permissions,tenantActive:row.tenant_active};
   }catch{await client.query('ROLLBACK').catch(()=>{});return null;}finally{client.release();}
  }
  const workflow=createUatWorkflow({roster:entries,store,provider,sessions,lookupMembership,authenticateAdministrator,authorizeIssuance,issuer,deliver});
  await workflow.maintain();await sessions.recoverStale();await transactions.expire();
  const handler=createUatCandidateHttp({origin:config.auth.origin,workflow,googleProvider,transactions,authorizeResource:({actor,resourceId})=>authorize({userId:actor.userId,resourceId})});
  return {handler,workflow,maintain:async()=>{await workflow.maintain();await sessions.recoverStale();await transactions.expire();},close:()=>Promise.all([authPool.end(),brokerPool.end()])};
 }catch{await Promise.allSettled([authPool.end(),brokerPool.end()]);throw Error('UAT_RUNTIME_UNAVAILABLE');}
}
