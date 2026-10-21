import {createAuthMaintenance} from './operations-auth-maintenance.mjs';
import {assertAuthDatabaseReady} from './operations-auth-database-check.mjs';
import {createConfiguredSessionCipher} from './operations-supabase-session-config.experimental.mjs';
import {createPostgresPkceTransactionStore} from './operations-supabase-pkce-postgres-store.experimental.mjs';
import {createPostgresOpaqueSessionStore} from './operations-supabase-opaque-session-store.experimental.mjs';
import {createSupabaseProvider} from './operations-supabase-provider.mjs';
import {createPrivateResourceAuthorizer} from './operations-auth-authorization.mjs';
import {createAuthApplication} from './operations-auth-application.mjs';
import {postgresTlsOptions} from './postgres-tls.mjs';
const project='vnoxdinldneeczxibicp';
export function resolveAuthRuntimeConfig(env){
 if(env.VERCEL_ENV!=='preview'||env.IWAY_AUTH_ENABLED!=='true'||env.IWAY_AUTH_SCHEMA_APPROVED!=='b498-v3'||
    !env.VERCEL_PROJECT_ID||env.VERCEL_PROJECT_ID!==env.IWAY_STAGING_VERCEL_PROJECT_ID||
    env.VERCEL_PROJECT_ID==='prj_0vutnbiNCYaxhdrbLfktrsHAvxty')throw Error('AUTH_STAGING_NOT_APPROVED');
 const origin=new URL(env.IWAY_AUTH_ORIGIN);
 if(origin.protocol!=='https:'||origin.origin!==env.IWAY_AUTH_ORIGIN||origin.origin!==env.IWAY_AUTH_APPROVED_ORIGIN)
  throw Error('AUTH_ORIGIN_NOT_APPROVED');
 const db=new URL(env.IWAY_AUTH_DATABASE_URL);
 const direct=db.hostname==='db.'+project+'.supabase.co';
 const pooler=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname);
 const user=decodeURIComponent(db.username);
 if(!['postgres:','postgresql:'].includes(db.protocol)||(!direct&&!pooler)||db.pathname!=='/postgres'||db.search||db.hash||
    !db.password||!['','5432'].includes(db.port)||user!==(direct?'iway_auth_runtime':'iway_auth_runtime.'+project))
  throw Error('AUTH_DATABASE_TARGET_INVALID');
 return {origin:origin.origin,provider:env.IWAY_AUTH_PROVIDER,apiKey:env.IWAY_SUPABASE_PUBLISHABLE_KEY,
  db:{host:db.hostname,port:5432,database:'postgres',user,password:decodeURIComponent(db.password),
   ssl:postgresTlsOptions(db.hostname),max:2,connectionTimeoutMillis:2000,idleTimeoutMillis:10000,
   statement_timeout:2000,query_timeout:3000,application_name:'iway-auth-staging'}};
}
export async function createAuthRuntime({env=process.env,PoolClass,fetchImpl=fetch}={}){
 const config=resolveAuthRuntimeConfig(env),cipher=createConfiguredSessionCipher(env);
 const Pool=PoolClass??(await import('pg')).Pool,pool=new Pool(config.db);
 pool.on('error',()=>{}); // Never serialize driver errors/connection details.
 try{
  await assertAuthDatabaseReady({query:(sql,args)=>pool.query(sql,args)});
  const query=(text,values)=>pool.query(text,values);
  const transactions=createPostgresPkceTransactionStore({query,cipher}),sessions=createPostgresOpaqueSessionStore({query,cipher});
  const maintain=createAuthMaintenance({transactions,sessions});await maintain();
  const provider=createSupabaseProvider({url:'https://'+project+'.supabase.co',apiKey:config.apiKey,provider:config.provider,redirectTo:config.origin+'/auth/callback',fetchImpl});
  const handler=createAuthApplication({origin:config.origin,provider,transactions,sessions,authorizeResource:createPrivateResourceAuthorizer({pool}),observe:event=>console.info(JSON.stringify(event))});
  return {handler:async(req,res)=>{await maintain();return handler(req,res);},close:()=>pool.end()};
 }catch{await pool.end().catch(()=>{});throw Error('AUTH_RUNTIME_UNAVAILABLE');}
}
