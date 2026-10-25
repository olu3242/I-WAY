import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionConfig,probeConnections} from '../scripts/staging-connection-probe.mjs';
const env={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',IWAY_STAGING_VERCEL_PROJECT_ID:'prj_7uof3CdmN1QvzKxETkXvHjlrLjVm',
 ...Object.fromEntries(['AUTH','UAT','OPERATIONS'].map(k=>['IWAY_'+k+'_DATABASE_URL','postgresql://iway_'+k.toLowerCase()+'_runtime:synthetic_password@db.vnoxdinldneeczxibicp.supabase.co:5432/postgres']))};
test('probe blocks non-Preview execution before opening any connection',async()=>{
 const r=await probeConnections({env:{...env,VERCEL_ENV:'production'},Client:class{constructor(){assert.fail();}}});
 assert.equal(r.status,'BLOCKED_TARGET');
});
test('probe rejects API URLs, administrator roles and transaction pooler ports',()=>{
 for(const value of ['https://vnoxdinldneeczxibicp.supabase.co',env.IWAY_AUTH_DATABASE_URL.replace('iway_auth_runtime','postgres'),env.IWAY_AUTH_DATABASE_URL.replace(':5432',':6543')])assert.throws(()=>connectionConfig(value,'AUTH'));
});
test('probe uses verified TLS and read-only role checks and closes connections',async()=>{
 let closed=0;
 class Client{
  constructor(config){this.config=config;assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.options,'-c default_transaction_read_only=on');}
  async connect(){}
  async query(sql){assert.ok(sql.startsWith('SELECT'));return {rows:[{login:this.config.user,actor:this.config.user,rolcanlogin:true,readonly:'on',tls:true}]};}
  async end(){closed++;}
 }
 const r=await probeConnections({env,Client});assert.equal(r.status,'PASS_CONNECTIONS_ONLY');assert.equal(r.hostedCertified,false);assert.equal(closed,3);
});
test('probe never serializes connection passwords or driver error messages',async()=>{
 class Client{async connect(){throw Object.assign(Error('synthetic_password raw connection data'),{code:'28P01'});}async end(){}}
 const r=await probeConnections({env,Client});assert.equal(r.status,'BLOCKED');
 assert.ok(r.connections.every(c=>c.status==='PASSWORD_AUTHENTICATION_FAILED'));assert.ok(!JSON.stringify(r).includes('synthetic_password'));
});
test('successful login with unsafe role flags is rejected',async()=>{
 class Client{constructor(c){this.c=c;}async connect(){}async query(){return {rows:[{login:this.c.user,actor:this.c.user,rolcanlogin:true,readonly:'on',tls:true,rolsuper:true}]};}async end(){}}
 const r=await probeConnections({env,Client});assert.ok(r.connections.every(c=>c.status==='ROLE_OR_TLS_CHECK_FAILED'));
});

test('probe reports fixed actionable format codes before any login attempt',async()=>{
 const invalid={...env,IWAY_AUTH_DATABASE_URL:env.IWAY_AUTH_DATABASE_URL.replace('iway_auth_runtime','postgres'),
 IWAY_UAT_DATABASE_URL:env.IWAY_UAT_DATABASE_URL.replace(':5432',':6543'),
 IWAY_OPERATIONS_DATABASE_URL:env.IWAY_OPERATIONS_DATABASE_URL.replace('db.vnoxdinldneeczxibicp.supabase.co','wrong.invalid')};
 const result=await probeConnections({env:invalid,Client:class{constructor(){assert.fail('No network for invalid config');}}});
 assert.deepEqual(result.connections.map(c=>c.status),['RESTRICTED_ROLE_REQUIRED','SESSION_PORT_5432_REQUIRED','PINNED_DATABASE_HOST_REQUIRED']);
 assert.ok(!JSON.stringify(result).includes('synthetic_password'));
});
