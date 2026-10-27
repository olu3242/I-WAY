// Protected Preview build probe. Uses the existing restricted Operations login.
import {Client} from 'pg';
import {buildOperationsPgConfig} from '../server/operations-postgres.mjs';
import {DurableOperationsPgEngine} from '../server/operations-durable-postgres.mjs';
import {assessStagingOnboarding} from './lib/staging-onboarding-preflight.mjs';
const env=process.env,project='prj_7uof3CdmN1QvzKxETkXvHjlrLjVm';
let client,result;
try{
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!==project||env.IWAY_STAGING_VERCEL_PROJECT_ID!==project)throw Error();
 const url=new URL(env.IWAY_OPERATIONS_DATABASE_URL);
 const config=buildOperationsPgConfig({databaseUrl:env.IWAY_OPERATIONS_DATABASE_URL,projectRef:'vnoxdinldneeczxibicp',endpoint:url.hostname,databaseName:'postgres',loginRole:'iway_operations_runtime'});
 client=new Client(config);client.on('error',()=>{});await client.connect();await client.query('BEGIN READ ONLY');
 const pool={query:(...args)=>client.query(...args),connect:async()=>Object.assign(client,{release(){}})};
 const engine=new DurableOperationsPgEngine({pool,config});await engine.health();
 result=await assessStagingOnboarding({env,pool,engine});
}catch{result={status:'BLOCKED',checks:[{check:'targetAndDatabase',status:'BLOCKED'}],hostedCertified:false,tenantWorkflow:'NOT_RUN'};}
finally{if(client){await client.query('ROLLBACK').catch(()=>{});await client.end().catch(()=>{});}}
console.log('IWAY_ONBOARDING_PROBE '+JSON.stringify(result));
if(result.status!=='PASS_PREREQUISITES_ONLY')process.exitCode=1;
