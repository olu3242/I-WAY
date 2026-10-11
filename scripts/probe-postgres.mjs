import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadProjectEnv} from './load-env.mjs';
import {ConfigurationError,postgresConfig} from '../server/config.mjs';

const expectedHost='aws-1-us-west-2.pooler.supabase.com';
const expectedUser='iway_registration_login.vnoxdinldneeczxibicp';
const query='SELECT current_user, current_database(), 1;';

export function probeConfig(env){
 const config=postgresConfig(env);
 if(!config)throw new ConfigurationError('DATABASE_URL: MISSING');
 const url=new URL(config.connectionString);
 if(url.hostname!==expectedHost||url.port!=='5432'||url.pathname!=='/postgres'||
    decodeURIComponent(url.username)!==expectedUser)
  throw new ConfigurationError('DATABASE_TARGET: INVALID');
 if(config.ssl?.rejectUnauthorized!==true||!config.ssl.ca)
  throw new ConfigurationError('PGSSL: INVALID');
 return {...config,query_timeout:10000};
}

export function sanitizedFailure(error){
 const code=String(error?.code??'');
 const message=String(error?.message??'');
 if(error instanceof ConfigurationError)return {category:'configuration',reason:
  /^[A-Z_]+: (MISSING|EMPTY|INVALID|PLACEHOLDER)$/.test(message)?message:'Configuration rejected.'};
 if(message==='SUPABASE_CA: INVALID_OR_UNAVAILABLE')
  return {category:'TLS',reason:message};
 const known={
  SELF_SIGNED_CERT_IN_CHAIN:['TLS','Untrusted self-signed certificate in chain.'],
  DEPTH_ZERO_SELF_SIGNED_CERT:['TLS','Untrusted self-signed certificate.'],
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:['TLS','Certificate chain verification failed.'],
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:['TLS','Certificate issuer is not trusted.'],
  ERR_TLS_CERT_ALTNAME_INVALID:['TLS','Certificate hostname mismatch.'],
  CERT_HAS_EXPIRED:['TLS','Certificate expired.'],
  CERT_NOT_YET_VALID:['TLS','Certificate not yet valid.'],
  ENOTFOUND:['network','DNS resolution failed.'],
  EAI_AGAIN:['network','Temporary DNS resolution failure.'],
  ECONNREFUSED:['network','Connection refused.'],
  ECONNRESET:['network','Connection reset.'],
  ENETUNREACH:['network','Network unreachable.'],
  EHOSTUNREACH:['network','Host unreachable.'],
  ETIMEDOUT:['network','Connection timed out.'],
  '28P01':['authentication','Restricted-role password authentication failed.'],
  '28000':['authentication','Database authorization failed.'],
  '3D000':['configuration','Configured database does not exist.'],
  '42501':['configuration','Authorized read-only query was denied.'],
  '53300':['network','Connection limit reached.'],
  '57P03':['network','Database not accepting connections.']
 };
 if(known[code])return {category:known[code][0],code,reason:known[code][1]};
 if(code==='XX000'&&/tenant or user not found/i.test(message))
  return {category:'pooler role support',code,reason:'Pooler could not resolve tenant or user; custom-role support is not established by this error alone.'};
 if(/SASL|SCRAM|password|authentication/i.test(message))
  return {category:'authentication',reason:'Authentication handshake failed; raw details suppressed.'};
 if(/timeout|timed out/i.test(message))
  return {category:'network',reason:'Connection or query timed out.'};
 if(/certificate|TLS|SSL/i.test(message))
  return {category:'TLS',reason:'TLS handshake failed; raw details suppressed.'};
 return {category:'undetermined',reason:'Connection failed; raw details suppressed.'};
}

export async function runProbe(env,{Client}){
 let client;
 try{
  const config=probeConfig(env);
  client=new Client(config);
  client.on('error',()=>{});
  await client.connect();
  if(client.connection.stream.encrypted!==true||client.connection.stream.authorized!==true)
   return {status:'CONNECTION BLOCKED',category:'TLS',reason:'Verified TLS session not confirmed; no SQL executed.'};
  const result=await client.query(query);
  const row=result.rows[0];
  if(result.rowCount!==1||row?.current_user!=='iway_registration_login'||
     row?.current_database!=='postgres'||row?.['?column?']!==1)
   return {status:'CONNECTION BLOCKED',category:'configuration',reason:'Unexpected effective identity, database, or query result.'};
  return {status:'CONNECTION VERIFIED',tls:'PASS',current_user:'iway_registration_login',
   current_database:'postgres',constant:1};
 }catch(error){return {status:'CONNECTION BLOCKED',...sanitizedFailure(error)}}
 finally{if(client)await client.end().catch(()=>{})}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new ConfigurationError('PGSSL: INVALID');
  // Deliberately inspect this project's file, not inherited DB credentials.
  const env={};loadProjectEnv({env});
  const {Client}=await import('pg');
  const result=await runProbe(env,{Client});
  console.log(JSON.stringify(result));
  console.log('Consent approval and hosted certification remain separate release gates.');
  if(result.status!=='CONNECTION VERIFIED')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({status:'CONNECTION BLOCKED',...sanitizedFailure(error)}));
  process.exitCode=1;
 }
}
