import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import tls from 'node:tls';
import {postgresConfig,serverConfig} from '../server/config.mjs';
import {postgresTlsOptions,supabaseRootFingerprint} from '../server/postgres-tls.mjs';
import {probeConfig,runProbe,sanitizedFailure} from '../scripts/probe-postgres.mjs';

const url=new URL('postgresql://aws-1-us-west-2.pooler.supabase.com:5432/postgres');
url.username='iway_registration_login.vnoxdinldneeczxibicp';
url.password='synthetic-test-only';
const env={DATABASE_URL:url.href,PGSSL:'require',IWAY_CONSENT_VERSION:''};

test('Supabase CA is pinned to the independently authenticated public root',async()=>{
 const pem=await readFile(new URL('../server/certs/supabase-prod-ca-2021.crt',import.meta.url));
 const root=new X509Certificate(pem);
 assert.equal(root.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
 assert.equal(root.fingerprint256,supabaseRootFingerprint);
 assert.ok(root.ca&&root.verify(root.publicKey));
 const options=postgresTlsOptions(url.hostname);
 assert.equal(options.rejectUnauthorized,true);
 assert.equal(new X509Certificate(options.ca).fingerprint256,root.fingerprint256);
 assert.equal(options.checkServerIdentity,undefined); // Node's hostname verifier remains active.
});

test('Supabase trust is connection-scoped and does not extend to lookalike domains',()=>{
 for(const host of ['example.invalid','pooler.supabase.com.attacker.invalid','db.another-project.supabase.co'])
  assert.deepEqual(postgresTlsOptions(host),{rejectUnauthorized:true});
 assert.ok(postgresTlsOptions('db.vnoxdinldneeczxibicp.supabase.co').ca);
});

test('connection-only validation leaves the production consent gate closed',()=>{
 assert.ok(postgresConfig(env).ssl.ca);
 assert.ok(probeConfig(env).ssl.ca);
 assert.throws(()=>serverConfig(env),/IWAY_CONSENT_VERSION: EMPTY/);
 assert.equal(env.IWAY_CONSENT_VERSION,'');
});

test('read-only probe rejects owner roles, other targets and TLS overrides',()=>{
 for(const [field,value] of [['username','postgres.vnoxdinldneeczxibicp'],['username','iway_registration_login.otherproject'],
  ['hostname','db.vnoxdinldneeczxibicp.supabase.co'],['hostname','example.invalid'],['port','6543'],['pathname','/other']]){
  const modified=new URL(url);modified[field]=value;
  assert.throws(()=>probeConfig({...env,DATABASE_URL:modified.href}));
 }
 const insecure=new URL(url);insecure.searchParams.set('sslmode','disable');
 assert.throws(()=>probeConfig({...env,DATABASE_URL:insecure.href}),/DATABASE_URL: INVALID/);
 assert.throws(()=>probeConfig({...env,PGSSL:'disable'}),/PGSSL: INVALID/);
});

function fixture({authorized=true,encrypted=true,error,row}={}){
 const calls={connect:0,queries:[],end:0,constructed:0};
 class Client{
  constructor(config){calls.constructed++;assert.equal(config.ssl.rejectUnauthorized,true);assert.ok(config.ssl.ca);
   this.connection={stream:{authorized,encrypted}};}
  on(){}
  async connect(){calls.connect++;if(error)throw error;}
  async query(sql){calls.queries.push(sql);return {rowCount:1,rows:[row??{current_user:'iway_registration_login',current_database:'postgres','?column?':1}]};}
  async end(){calls.end++;}
 }
 return {Client,calls};
}

test('read-only probe executes only the authorized SELECT and closes the connection',async()=>{
 const {Client,calls}=fixture();
 const result=await runProbe(env,{Client});
 assert.equal(result.status,'CONNECTION VERIFIED');
 assert.deepEqual(calls.queries,['SELECT current_user, current_database(), 1;']);
 assert.equal(calls.connect,1);assert.equal(calls.end,1);
});

test('unverified TLS sessions never reach a query',async()=>{
 for(const settings of [{authorized:false},{encrypted:false}]){
  const {Client,calls}=fixture(settings);
  const result=await runProbe(env,{Client});
  assert.equal(result.status,'CONNECTION BLOCKED');assert.equal(result.category,'TLS');
  assert.deepEqual(calls.queries,[]);assert.equal(calls.end,1);
 }
});

test('authentication and TLS errors are sanitized without retries',async()=>{
 for(const [code,category] of [['28P01','authentication'],['SELF_SIGNED_CERT_IN_CHAIN','TLS']]){
  const error=Object.assign(new Error('synthetic-secret-canary'),{code});
  const {Client,calls}=fixture({error});
  const result=await runProbe(env,{Client});
  assert.equal(result.category,category);assert.equal(result.code,code);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-secret-canary/);
  assert.equal(calls.connect,1);assert.deepEqual(calls.queries,[]);assert.equal(calls.end,1);
 }
 const result=sanitizedFailure(new Error('synthetic-secret-canary'));
 assert.doesNotMatch(JSON.stringify(result),/synthetic-secret-canary/);
});

test('probe denies identity mismatches and invalid configuration without returning raw rows',async()=>{
 const {Client,calls}=fixture({row:{current_user:'synthetic-private-canary',current_database:'postgres','?column?':1}});
 const result=await runProbe(env,{Client});
 assert.equal(result.status,'CONNECTION BLOCKED');
 assert.doesNotMatch(JSON.stringify(result),/synthetic-private-canary/);
 const before=calls.constructed;
 assert.equal((await runProbe({...env,DATABASE_URL:'invalid'},{Client})).status,'CONNECTION BLOCKED');
 assert.equal(calls.constructed,before);
});

test('missing, substituted, or extended CA bundles fail closed',async t=>{
 const root=await mkdtemp(join(tmpdir(),'iway-tls-test-'));
 const prefix=resolve(tmpdir())+sep+'iway-tls-test-';
 if(!resolve(root).startsWith(prefix))throw new Error('Unexpected temporary fixture path');
 t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'certs'));
 await copyFile(new URL('../server/postgres-tls.mjs',import.meta.url),join(root,'postgres-tls.mjs'));
 const isolated=await import(pathToFileURL(join(root,'postgres-tls.mjs')).href);
 const caPath=join(root,'certs/supabase-prod-ca-2021.crt');
 assert.throws(()=>isolated.postgresTlsOptions(url.hostname),/SUPABASE_CA: INVALID_OR_UNAVAILABLE/);
 await writeFile(caPath,tls.rootCertificates[0]);
 assert.throws(()=>isolated.postgresTlsOptions(url.hostname),/SUPABASE_CA: INVALID_OR_UNAVAILABLE/);
 const official=await readFile(new URL('../server/certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8');
 await writeFile(caPath,official+'\n'+tls.rootCertificates[0]);
 assert.throws(()=>isolated.postgresTlsOptions(url.hostname),/SUPABASE_CA: INVALID_OR_UNAVAILABLE/);
 await writeFile(caPath,official);
 assert.equal(isolated.postgresTlsOptions(url.hostname).rejectUnauthorized,true);
});
