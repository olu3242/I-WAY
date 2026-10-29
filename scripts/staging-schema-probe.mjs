import {uatProject} from '../server/operations-uat-target.mjs';
// Explicit protected Preview diagnostic; executes read-only runtime readiness checks.
import {Client} from 'pg';
import {connectionConfig} from './staging-connection-probe.mjs';
import {assertAuthDatabaseReady} from '../server/operations-auth-database-check.mjs';
import {assertUatPostgresRuntime} from '../server/operations-uat-postgres.mjs';
import {buildOperationsPgConfig} from '../server/operations-postgres.mjs';
import {DurableOperationsPgEngine} from '../server/operations-durable-postgres.mjs';
const env=process.env,checks=[];
if(env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!=='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm'||env.IWAY_STAGING_VERCEL_PROJECT_ID!==env.VERCEL_PROJECT_ID){
 console.log('IWAY_SCHEMA_PROBE {"status":"BLOCKED_TARGET"}');process.exitCode=1;
}else{
 for(const kind of ['AUTH','UAT','OPERATIONS']){
  let client;
  try{
   const name='IWAY_'+kind+'_DATABASE_URL';
   const parsed=connectionConfig(env[name],kind);
   const config=kind==='OPERATIONS'?buildOperationsPgConfig({databaseUrl:env[name],projectRef:uatProject,endpoint:parsed.host,databaseName:'postgres',loginRole:'iway_operations_runtime'}):parsed;
   client=new Client(config);client.on('error',()=>{});await client.connect();await client.query('BEGIN READ ONLY');
   const pool={query:(...args)=>client.query(...args),connect:async()=>Object.assign(client,{release(){}})};
   if(kind==='AUTH')await assertAuthDatabaseReady(pool);
   else if(kind==='UAT')await assertUatPostgresRuntime(pool);
   else await new DurableOperationsPgEngine({pool,config}).health();
   checks.push({role:kind,status:'PASS_RUNTIME_SCHEMA_READINESS'});
  }catch{checks.push({role:kind,status:'RUNTIME_SCHEMA_READINESS_FAILED'});}
  finally{if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}}
 }
 const pass=checks.every(c=>c.status==='PASS_RUNTIME_SCHEMA_READINESS');
 console.log('IWAY_SCHEMA_PROBE '+JSON.stringify({status:pass?'PASS_SCHEMA_READINESS_ONLY':'BLOCKED',checks,hostedCertified:false,tenantWorkflow:'NOT_RUN'}));
 if(!pass)process.exitCode=1;
}
