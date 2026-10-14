<<<<<<< HEAD
import {X509Certificate,randomUUID} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
import {AsyncCommandError} from '../domain/operations-async-command.mjs';
=======
import {randomUUID} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
import {postgresTlsOptions} from './postgres-tls.mjs';

// Readiness adapter only. The synchronous SQLite Operations engine cannot consume this contract.
export const operationsPostgresReadiness=Object.freeze({
 adapter:'async-postgresql-contract',engineIntegration:'BLOCKED',migrationApplied:false,
 hostedConnectionExecuted:false,rlsExecution:'BLOCKED',
 blockers:Object.freeze(['Approved operations-specific login and grants','Approved local PostgreSQL execution of migration and RLS tests','Async command engine and authentication parity','Hosted authorization and separate release gates'])
});
const configs=new WeakSet();
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const kind=value=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,47}$/.test(value);
export class OperationsPgError extends Error{
 constructor(code){super('Operations PostgreSQL '+code.toLowerCase().replaceAll('_',' ')+'.');this.name='OperationsPgError';this.code=code;}
}
function ensure(value,code='CONFIGURATION'){if(!value)throw new OperationsPgError(code);}
function sanitized(error){
<<<<<<< HEAD
 if(error instanceof OperationsPgError||error instanceof AsyncCommandError)return error;
=======
 if(error instanceof OperationsPgError)return error;
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 const code=String(error?.code??'');
 return new OperationsPgError(code==='28P01'||code==='28000'?'AUTHENTICATION':/CERT|TLS|SSL|SELF_SIGNED/.test(code)?'TLS':/^(ECONN|ENOTFOUND|EAI_|ETIMEDOUT)/.test(code)?'NETWORK':code==='23505'?'CONFLICT':code==='42501'?'AUTHORIZATION':code==='40001'||code==='40P01'?'RETRY_TRANSACTION':'DATABASE_FAILURE');
}
export function buildOperationsPgConfig({databaseUrl,projectRef,endpoint,databaseName,loginRole}={}){
 // All expected values must come from an approved server configuration, never request input.
 ensure(typeof databaseUrl==='string'&&/^[a-z0-9]{20}$/.test(projectRef??''));
 ensure(/^iway_operations_[a-z0-9_]{1,32}$/.test(loginRole??''));
 ensure(typeof databaseName==='string'&&/^[a-zA-Z0-9_]{1,63}$/.test(databaseName));
 const direct=endpoint==='db.'+projectRef+'.supabase.co';
 ensure(direct||/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(endpoint??''));
 let url;try{url=new URL(databaseUrl)}catch{throw new OperationsPgError('CONFIGURATION')}
 let username,password,path;try{username=decodeURIComponent(url.username);password=decodeURIComponent(url.password);path=decodeURIComponent(url.pathname.slice(1))}catch{throw new OperationsPgError('CONFIGURATION')}
 ensure(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname===endpoint&&url.port==='5432'&&path===databaseName&&!url.search&&!url.hash);
 ensure(username===(direct?loginRole:loginRole+'.'+projectRef)&&password.length>=12&&!/^(?:change.?me|example|placeholder|password)$/i.test(password));
 const ssl=Object.freeze({...postgresTlsOptions(endpoint)});
 ensure(ssl.rejectUnauthorized===true&&!Object.hasOwn(ssl,'checkServerIdentity'));
 const config=Object.freeze({connectionString:databaseUrl,ssl,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,max:5,
  expected:Object.freeze({endpoint,databaseName,username,loginRole,port:5432})});
 configs.add(config);return config;
}
<<<<<<< HEAD
// Test-only configuration. No hosted endpoint can use a caller-supplied CA.
export function buildLocalOperationsPgConfig({optIn=false,connection,ca}={}){
 ensure(optIn===true&&connection?.host==='127.0.0.1'&&connection.port===5433&&connection.database==='iway_fixture'&&connection.user==='iway_operations_fixture'&&typeof connection.password==='string'&&connection.password.length>=32);
 let certificate;try{certificate=new X509Certificate(ca)}catch{throw new OperationsPgError('CONFIGURATION')}
 ensure(certificate.ca&&certificate.verify(certificate.publicKey)&&Date.parse(certificate.validFrom)<=Date.now()&&Date.parse(certificate.validTo)>Date.now());
 const config=Object.freeze({host:connection.host,port:connection.port,database:connection.database,user:connection.user,password:connection.password,
 ssl:Object.freeze({ca,rejectUnauthorized:true,minVersion:'TLSv1.2'}),max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:5000,
 expected:Object.freeze({endpoint:connection.host,port:connection.port,databaseName:connection.database,username:connection.user,loginRole:connection.user}),localFixture:true});
 configs.add(config);return config;
}
const HEALTH_SQL="SELECT current_user AS login, current_database() AS database, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, r.rolreplication, s.ssl, EXISTS (SELECT 1 FROM pg_catalog.pg_roles p WHERE pg_catalog.pg_has_role(current_user,p.oid,'MEMBER') AND (p.rolsuper OR p.rolbypassrls OR p.rolcreaterole OR p.rolcreatedb OR p.rolreplication OR p.rolname IN ('pg_write_all_data','pg_read_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint','pg_maintain'))) AS elevated_membership, EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='operations_private' AND pg_catalog.pg_has_role(current_user,n.nspowner,'MEMBER')) OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_private' AND pg_catalog.pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_operations FROM pg_catalog.pg_roles r LEFT JOIN pg_catalog.pg_stat_ssl s ON s.pid=pg_catalog.pg_backend_pid() WHERE r.rolname=current_user";
async function verifiedClient(client,config){
 const expected=config.expected,p=client.connectionParameters,stream=client.connection?.stream;
 ensure(p&&p.host===expected.endpoint&&Number(p.port)===expected.port&&p.database===expected.databaseName&&p.user===expected.username,'CONNECTION_CONFIGURATION');
=======
const HEALTH_SQL="SELECT current_user AS login, current_database() AS database, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, r.rolreplication, s.ssl, EXISTS (SELECT 1 FROM pg_catalog.pg_roles p WHERE pg_catalog.pg_has_role(current_user,p.oid,'MEMBER') AND (p.rolsuper OR p.rolbypassrls OR p.rolcreaterole OR p.rolcreatedb OR p.rolreplication OR p.rolname IN ('pg_write_all_data','pg_read_all_data','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint','pg_maintain'))) AS elevated_membership, EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='operations_private' AND pg_catalog.pg_has_role(current_user,n.nspowner,'MEMBER')) OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_private' AND pg_catalog.pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_operations FROM pg_catalog.pg_roles r LEFT JOIN pg_catalog.pg_stat_ssl s ON s.pid=pg_catalog.pg_backend_pid() WHERE r.rolname=current_user";
async function verifiedClient(client,config){
 const expected=config.expected,p=client.connectionParameters,stream=client.connection?.stream;
 ensure(p&&p.host===expected.endpoint&&Number(p.port)===5432&&p.database===expected.databaseName&&p.user===expected.username,'CONNECTION_CONFIGURATION');
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
 ensure(p.ssl?.rejectUnauthorized===true&&!p.ssl.checkServerIdentity&&stream?.encrypted===true&&stream.authorized===true,'TLS');
 let certificate;try{certificate=stream.getPeerCertificate(true)}catch{throw new OperationsPgError('TLS')}
 ensure(certificate&&Object.keys(certificate).length>0&&!checkServerIdentity(expected.endpoint,certificate),'TLS');
 const {rows}=await client.query(HEALTH_SQL),row=rows[0];
 ensure(row&&row.login===expected.loginRole&&row.database===expected.databaseName,'IDENTITY');
 ensure(row.ssl===true,'TLS');
 ensure([row.rolsuper,row.rolbypassrls,row.rolcreaterole,row.rolcreatedb,row.rolreplication,row.elevated_membership,row.owns_operations].every(v=>v===false),'RESTRICTED_ROLE');
 return {identityVerified:true,tlsVerified:true,restrictedRole:true};
}
function dataJSON(value){
 ensure(value&&typeof value==='object'&&!Array.isArray(value),'INPUT');
 let encoded;try{encoded=JSON.stringify(value)}catch{throw new OperationsPgError('INPUT')}
 ensure(Buffer.byteLength(encoded)<=262144,'INPUT');return encoded;
}
function validateResource(kindValue,id){ensure(kind(kindValue)&&uuid(id),'INPUT');}
function scopedMethods(query,scope){
 const tenant=scope.tenantId,actor=scope.actorId;
 return Object.freeze({
<<<<<<< HEAD
  async lockTenant(){await query('SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,0))',[tenant]);},
  async principal(){const r=await query('SELECT data FROM operations_private.users WHERE tenant_id=$1 AND id=$2',[tenant,actor]);return r.rows[0]?.data??null;},
  async user(id){ensure(uuid(id),'INPUT');const r=await query("SELECT jsonb_build_object('id',id,'tenantId',tenant_id,'role','dispatcher','active',active) AS data FROM operations_private.dispatcher_directory WHERE tenant_id=$1 AND id=$2",[tenant,id]);return r.rows[0]?.data??null;},
=======
  async principal(){const r=await query('SELECT data FROM operations_private.users WHERE tenant_id=$1 AND id=$2',[tenant,actor]);return r.rows[0]?.data??null;},
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
  async tenant(){const r=await query('SELECT id,name,timezone FROM operations_private.tenants WHERE id=$1',[tenant]);return r.rows[0]??null;},
  async list(kindValue,{limit=200,afterId=null}={}){
   ensure(kind(kindValue)&&Number.isInteger(limit)&&limit>=1&&limit<=500&&(afterId===null||uuid(afterId)),'INPUT');
   const r=await query('SELECT data FROM operations_private.resources WHERE tenant_id=$1 AND kind=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[tenant,kindValue,afterId,limit]);return r.rows.map(x=>x.data);
  },
  async get(kindValue,id){validateResource(kindValue,id);const r=await query('SELECT data FROM operations_private.resources WHERE tenant_id=$1 AND kind=$2 AND id=$3',[tenant,kindValue,id]);ensure(r.rowCount===1,'NOT_FOUND');return r.rows[0].data;},
  async insert(kindValue,values){
   ensure(kind(kindValue),'INPUT');const id=values?.id??randomUUID();validateResource(kindValue,id);
   ensure(!values?.tenantId||values.tenantId===tenant,'OWNERSHIP');ensure(!values?.kind||values.kind===kindValue,'OWNERSHIP');
   const data={...values,id,kind:kindValue,tenantId:tenant,version:1};
   const r=await query('INSERT INTO operations_private.resources(tenant_id,kind,id,version,data) VALUES($1,$2,$3,1,$4::jsonb) RETURNING data',[tenant,kindValue,id,dataJSON(data)]);return r.rows[0].data;
  },
  async update(kindValue,id,expectedVersion,patch){
   validateResource(kindValue,id);ensure(Number.isInteger(expectedVersion)&&expectedVersion>0,'INPUT');dataJSON(patch);
   ensure(!Object.hasOwn(patch,'id')&&!Object.hasOwn(patch,'kind')&&!Object.hasOwn(patch,'tenantId')&&!Object.hasOwn(patch,'version'),'OWNERSHIP');
   const r=await query("UPDATE operations_private.resources SET data=data || $5::jsonb || jsonb_build_object('version',version+1),version=version+1 WHERE tenant_id=$1 AND kind=$2 AND id=$3 AND version=$4 RETURNING data",[tenant,kindValue,id,expectedVersion,dataJSON(patch)]);
   ensure(r.rowCount===1,'STALE');return r.rows[0].data;
  },
  async command(key){
   ensure(uuid(key),'INPUT');const r=await query('SELECT digest,result FROM operations_private.commands WHERE tenant_id=$1 AND actor_id=$2 AND key=$3',[tenant,actor,key]);return r.rows[0]??null;
  },
  async recordCommand(key,digest,result){
   ensure(uuid(key)&&/^[a-f0-9]{64}$/.test(digest??''),'INPUT');
   const r=await query('INSERT INTO operations_private.commands(tenant_id,actor_id,key,digest,result) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING key',[tenant,actor,key,digest,dataJSON(result)]);return r.rows[0].key;
  },
  async audit({action,resourceId=null,outcome='success',detail={}}={}){
   ensure(/^[a-z][a-z0-9:_-]{1,79}$/.test(action??'')&&(resourceId===null||uuid(resourceId))&&['success','denied','failure'].includes(outcome),'INPUT');
   const allowed=['kind','from','to','checkpoint','fence','reasonCode'];
   ensure(Object.entries(detail).every(([key,value])=>allowed.includes(key)&&(typeof value==='number'&&Number.isSafeInteger(value)||typeof value==='string'&&/^[a-zA-Z0-9:_-]{1,80}$/.test(value)||value===null)),'AUDIT_METADATA');
   const r=await query('INSERT INTO operations_private.audit(id,tenant_id,actor_id,action,resource_id,outcome,detail) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING sequence',[randomUUID(),tenant,actor,action,resourceId,outcome,dataJSON(detail)]);return r.rows[0].sequence;
  }
 });
}
export class AsyncOperationsPgStore{
 #pool;#config;
 constructor(pool,{config}={}){
  ensure(pool&&typeof pool.connect==='function'&&configs.has(config));
  this.#pool=pool;this.#config=config;
 }
 async health(){
  let client,discard=false;
  try{client=await this.#pool.connect();return await verifiedClient(client,this.#config)}
  catch(error){discard=true;throw sanitized(error)}
  finally{if(client)client.release(discard)}
 }
 async transaction(scope,work){
  ensure(scope&&uuid(scope.tenantId)&&uuid(scope.actorId)&&typeof work==='function','CONTEXT');
  const bound=Object.freeze({tenantId:scope.tenantId,actorId:scope.actorId});
  let client,started=false,open=false,discard=false,failed;
  const pending=new Set();
  try{
   client=await this.#pool.connect();await verifiedClient(client,this.#config);
   await client.query('BEGIN');started=true;
   await client.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true),set_config('statement_timeout',$3,true),set_config('lock_timeout',$4,true)",[bound.tenantId,bound.actorId,'5000','2000']);
<<<<<<< HEAD
   // Serialize before principal and replay checks; the lock releases on commit/rollback.
   await client.query('SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,0))',[bound.tenantId]);
=======
>>>>>>> origin/feat/fcc-03-batches-2-11-driver-offline
   const principal=await client.query("SELECT id FROM operations_private.users WHERE tenant_id=$1 AND id=$2 AND data->>'active'='true'",[bound.tenantId,bound.actorId]);
   ensure(principal.rowCount===1,'AUTHORIZATION');
   open=true;
   const query=(sql,params)=>{
    ensure(open,'TRANSACTION_CLOSED');
    const request=client.query(sql,params).catch(error=>{failed??=error;throw error});
    pending.add(request);request.then(()=>pending.delete(request),()=>pending.delete(request));return request;
   };
   const result=await work(scopedMethods(query,bound));
   open=false;await Promise.allSettled([...pending]);if(failed)throw failed;
   await client.query('COMMIT');started=false;return result;
  }catch(error){
   open=false;await Promise.allSettled([...pending]);
   if(client&&started)try{await client.query('ROLLBACK')}catch{discard=true}
   else if(client)discard=true;
   throw sanitized(error);
  }finally{open=false;if(client)client.release(discard)}
 }
}
