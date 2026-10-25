// Read-only Preview build probe. Never serves results or serializes driver errors.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {postgresTlsOptions} from '../server/postgres-tls.mjs';
const project='vnoxdinldneeczxibicp';
export function connectionConfig(value,kind){
 const role='iway_'+kind.toLowerCase()+'_runtime';
 let url;try{url=new URL(value);}catch{throw Error('CONNECTION_FORMAT_INVALID');}
 if(['http:','https:'].includes(url.protocol))throw Error('API_URL_NOT_DATABASE');
 const direct=url.hostname==='db.'+project+'.supabase.co';
 const pooled=/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
 let user,password;try{user=decodeURIComponent(url.username);password=decodeURIComponent(url.password);}catch{throw Error('CONNECTION_FORMAT_INVALID');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('POSTGRES_PROTOCOL_REQUIRED');
 if(!direct&&!pooled)throw Error('PINNED_DATABASE_HOST_REQUIRED');
 if(url.pathname!=='/postgres')throw Error('POSTGRES_DATABASE_REQUIRED');
 if(url.search||url.hash)throw Error('QUERY_OR_FRAGMENT_NOT_ALLOWED');
 if(user!==(direct?role:role+'.'+project))throw Error('RESTRICTED_ROLE_REQUIRED');
 if(!password)throw Error('ROLE_PASSWORD_REQUIRED');
 if(!['','5432'].includes(url.port)||kind==='OPERATIONS'&&url.port!=='5432')throw Error('SESSION_PORT_5432_REQUIRED');
 if(kind==='OPERATIONS'&&password.length<12)throw Error('OPERATIONS_PASSWORD_TOO_SHORT');
 return {host:url.hostname,port:5432,database:'postgres',user,password,ssl:postgresTlsOptions(url.hostname),
  connectionTimeoutMillis:8000,query_timeout:5000,statement_timeout:4000,application_name:'iway-readonly-connection-probe',
  options:'-c default_transaction_read_only=on'};
}
export async function probeConnections({env=process.env,Client}={}){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!=='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm'||
    env.IWAY_STAGING_VERCEL_PROJECT_ID!==env.VERCEL_PROJECT_ID)return {status:'BLOCKED_TARGET',connections:[],hostedCertified:false};
 const connections=[];
 for(const kind of ['AUTH','UAT','OPERATIONS']){
  const name='IWAY_'+kind+'_DATABASE_URL',role='iway_'+kind.toLowerCase()+'_runtime';
  let config;
  try{config=connectionConfig(env[name],kind);}catch(e){connections.push({name,status:['API_URL_NOT_DATABASE','POSTGRES_PROTOCOL_REQUIRED','PINNED_DATABASE_HOST_REQUIRED','POSTGRES_DATABASE_REQUIRED','QUERY_OR_FRAGMENT_NOT_ALLOWED','RESTRICTED_ROLE_REQUIRED','ROLE_PASSWORD_REQUIRED','SESSION_PORT_5432_REQUIRED','OPERATIONS_PASSWORD_TOO_SHORT'].includes(e.message)?e.message:'CONNECTION_FORMAT_INVALID'});continue;}
  let client;
  try{
   client=new Client(config);client.on?.('error',()=>{});
   await client.connect();
   const {rows}=await client.query(`SELECT session_user AS login, current_user AS actor,
    rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit, rolreplication, rolcanlogin,
    current_setting('transaction_read_only') AS readonly,
    EXISTS(SELECT 1 FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl) AS tls
    FROM pg_roles WHERE rolname=current_user`);
   const r=rows[0];
   const valid=r?.login===role&&r.actor===role&&r.rolcanlogin&&r.readonly==='on'&&r.tls&&
    !['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolinherit','rolreplication'].some(k=>r[k]);
   connections.push({name,status:valid?'PASS_READONLY_LOGIN_TLS_ROLE':'ROLE_OR_TLS_CHECK_FAILED'});
  }catch(e){
   const code=e?.code;
   const status=code==='28P01'?'PASSWORD_AUTHENTICATION_FAILED':code==='42501'?'PERMISSION_DENIED':
    ['ENOTFOUND','EAI_AGAIN'].includes(code)?'DNS_FAILED':
    ['ETIMEDOUT','ENETUNREACH','ECONNREFUSED'].includes(code)?'NETWORK_FAILED':
    ['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN'].includes(code)?'TLS_FAILED':'CONNECTION_CHECK_FAILED';
   connections.push({name,status});
  }finally{if(client)await client.end().catch(()=>{});}
 }
 return {status:connections.every(c=>c.status==='PASS_READONLY_LOGIN_TLS_ROLE')?'PASS_CONNECTIONS_ONLY':'BLOCKED',
  connections,hostedCertified:false,schemaAndTenantChecks:'NOT_RUN'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {Client}=await import('pg');
  const result=await probeConnections({Client});
  console.log('IWAY_CONNECTION_PROBE '+JSON.stringify(result));
  if(result.status!=='PASS_CONNECTIONS_ONLY')process.exitCode=1;
 }catch{console.log('IWAY_CONNECTION_PROBE {"status":"PROBE_FAILED","hostedCertified":false}');process.exitCode=1;}
}
