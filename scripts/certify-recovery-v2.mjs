// Local recovered managed stack only; never accepts a database URL.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {labId,assertLabContainer,migrationManifest,safeRestoreError} from './lib/recovery-v2.mjs';
const container='supabase_db_'+labId,dir='dist/b902-b1000/recovery';
function inspect(){const r=spawnSync('docker',['inspect',container],{encoding:'utf8'});if(r.status)throw Error('LOCAL_CONTAINER_UNAVAILABLE');assertLabContainer(JSON.parse(r.stdout)[0]);}
function sql(text,{administrator=false,expectedFailure=false}={}){
 inspect();const r=spawnSync('docker',['exec','-i',container,'psql','-X','-U',administrator?'supabase_admin':'postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{input:text,encoding:'utf8',maxBuffer:2000000,timeout:30000});
 if(expectedFailure){if(r.status===0)throw Error('INJECTED_FAILURE_NOT_DETECTED');return safeRestoreError(r.stderr)}
 if(r.status!==0){const e=Error('LOCAL_SQL_FAILED');e.safe=safeRestoreError(r.stderr);throw e}return r.stdout.trim();
}
const checks=[],migrations=[];
try{
 if(process.argv.includes('--resume')){
  const prior=JSON.parse(readFileSync(dir+'/migration-certification-failure.json'));
  const current=migrationManifest('supabase/migrations');
  if(prior.migrations.length!==8||prior.migrations.some((m,i)=>m.sha256!==current[i].sha256||m.status!=='PASS'))throw Error('RESUME_EVIDENCE_MISMATCH');
  checks.push(...prior.checks);migrations.push(...prior.migrations);
 }else{
 const restored=JSON.parse(readFileSync(dir+'/restoration.json'));if(restored.status!=='PASS_LOGICAL_BACKUP_RESTORE_ONLY')throw Error('VERIFIED_RESTORE_REQUIRED');
 const counts=restored.counts.map(t=>({...t,independentActual:Number(sql('SELECT count(*) FROM "'+t.schema+'"."'+t.table+'";'))}));
 if(counts.some(t=>t.expected!==t.independentActual))throw Error('INDEPENDENT_RESTORE_COUNTS_FAILED');checks.push({check:'independent_restore_counts',status:'PASS',tables:counts.length,rows:counts.reduce((n,t)=>n+t.independentActual,0)});
 if(sql("SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;")!=='0')throw Error('UNVALIDATED_FOREIGN_KEYS');checks.push({check:'managed_foreign_keys_validated',status:'PASS'});
 const failed=sql('BEGIN; CREATE TABLE public.iway_recovery_atomic_probe(id integer); SELECT 1/0; COMMIT;',{administrator:true,expectedFailure:true});
 if(sql("SELECT to_regclass('public.iway_recovery_atomic_probe') IS NULL;")!=='t')throw Error('FAILED_RESTORE_LEFT_PARTIAL_TABLE');checks.push({check:'transactional_failure_rollback',status:failed.sqlState==='22012'?'PASS':'FAIL',injectedSqlState:failed.sqlState});
 if(sql("SELECT to_regnamespace('operations_private') IS NULL;")!=='t')throw Error('FRESH_APPLICATION_BASELINE_REQUIRED');
 for(const m of migrationManifest('supabase/migrations')){
  let body=readFileSync('supabase/migrations/'+m.file,'utf8');if(!m.transaction)body='BEGIN;\n'+body+'\nCOMMIT;';
  sql(body);migrations.push({...m,status:'PASS',localExecutionIdentity:'postgres',wrappedTransaction:!m.transaction});
 }
 }
 // Authenticate as the actual restricted local runtime. No SET ROLE or admin
 // connection is used for any runtime assertion. Password lives only in memory.
 const password=randomBytes(32).toString('hex'),tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),otherActor=randomUUID();
 sql("ALTER ROLE iway_operations_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '"+password+"';",{administrator:true});
 sql(`INSERT INTO operations_private.tenants(id,name,timezone) VALUES('${tenant}','Synthetic recovery A','UTC'),('${other}','Synthetic recovery B','UTC');
 INSERT INTO operations_private.users(tenant_id,id,username,data,password_hash) VALUES
 ('${tenant}','${actor}','recovery-a','${JSON.stringify({id:actor,tenantId:tenant,role:'carrier',active:true,permissions:['load:view','load:create']})}','not-a-login-credential'),
 ('${other}','${otherActor}','recovery-b','${JSON.stringify({id:otherActor,tenantId:other,role:'carrier',active:true,permissions:['load:view','load:create']})}','not-a-login-credential');
 INSERT INTO operations_private.resources(tenant_id,kind,id,version,data) VALUES
 ('${tenant}','load','${tenant}',1,'${JSON.stringify({id:tenant,tenantId:tenant,kind:'load',version:1})}'),
 ('${other}','load','${other}',1,'${JSON.stringify({id:other,tenantId:other,kind:'load',version:1})}');`,{administrator:true});
 const connection={host:'127.0.0.1',port:60422,database:'postgres',user:'iway_operations_runtime',password,ssl:false,connectionTimeoutMillis:5000};
 const wrong=new Client({...connection,password:'incorrect-synthetic-password'});let denied=false;
 try{await wrong.connect()}catch(e){denied=e.code==='28P01'}finally{await wrong.end().catch(()=>{})}if(!denied)throw Error('PASSWORD_AUTHENTICATION_NOT_ENFORCED');checks.push({check:'wrong_password_denied',status:'PASS'});
 const runtime=new Client(connection);await runtime.connect();
 try{
  const r=(await runtime.query('SELECT session_user,current_user,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0];
  if(r.session_user!=='iway_operations_runtime'||r.current_user!==r.session_user||r.rolsuper||r.rolbypassrls||r.rolinherit)throw Error('RUNTIME_IDENTITY_INVALID');checks.push({check:'actual_restricted_runtime_login',status:'PASS',sessionUser:r.session_user,currentUser:r.current_user});
  await runtime.query('BEGIN');await runtime.query("SELECT set_config('iway.tenant_id',$1,true),set_config('iway.actor_id',$2,true)",[tenant,actor]);
  if(Number((await runtime.query('SELECT count(*) FROM operations_private.resources')).rows[0].count)!==1)throw Error('SAME_TENANT_READ_FAILED');checks.push({check:'same_tenant_read',status:'PASS'});
  await runtime.query("SELECT set_config('iway.tenant_id',$1,true)",[other]);if(Number((await runtime.query('SELECT count(*) FROM operations_private.resources')).rows[0].count)!==0)throw Error('CROSS_TENANT_DISCLOSURE');checks.push({check:'cross_tenant_read_denied',status:'PASS'});await runtime.query('ROLLBACK');
  let mutationDenied=false;try{await runtime.query("UPDATE operations_private.resources SET version=version+1")}catch(e){mutationDenied=e.code==='42501'}if(!mutationDenied)throw Error('READ_RUNTIME_MUTATION_ACCEPTED');checks.push({check:'unauthorized_runtime_mutation_denied',status:'PASS'});
 }finally{await runtime.end()}
 const forced=JSON.parse(sql("SELECT json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='operations_private' AND c.relkind='r';"));
 if(forced.some(t=>!t.rls||!t.force))throw Error('OPERATIONS_FORCE_RLS_MISSING');checks.push({check:'operations_force_rls',status:'PASS',tables:forced.length});
 const result={status:'PASS_LOCAL_RECOVERED_PLATFORM_MIGRATIONS',scope:'PostgreSQL17.11 Supabase local V2; no hosted execution',checks,migrations,hostedExecuted:false,priorForwardRecoveryReused:true};writeFileSync(dir+'/migration-certification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,migrations:migrations.length,checks:checks.length}));
}catch(e){writeFileSync(dir+'/migration-certification-failure.json',JSON.stringify({status:'FAIL',code:e.message,diagnostic:e.safe??null,checks,migrations,hostedExecuted:false},null,2));console.error(JSON.stringify({status:'FAIL_LOCAL_CERTIFICATION',code:e.message,diagnostic:e.safe??null,migrations:migrations.length}));process.exitCode=1;}
