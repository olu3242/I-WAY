// Reuses the established disposable TLS cluster. Never reads .env or existing hosted credentials.
import {isolatedPostgres} from './lib/isolated-postgres.mjs';
import {spawn} from 'node:child_process';
if(process.env.IWAY_AUTH_LOCAL_OPT_IN!=='true')throw Error('LOCAL_AUTH_FIXTURE_OPT_IN_REQUIRED');
const fixture=await isolatedPostgres({optIn:true});
try{
 await fixture.admin.query('CREATE DATABASE iway_auth_fixture');
 const options=fixture.admin.options;
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--test','tests/local/operations-auth-postgres.test.mjs'],{
   stdio:'inherit',windowsHide:true,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5433',PGDATABASE:'iway_auth_fixture',
    PGUSER:options.user,PGPASSWORD:options.password,PGSSLMODE:'verify-full',NODE_EXTRA_CA_CERTS:fixture.caPath,IWAY_AUTH_FIXTURE:'true'}});
  child.once('error',reject);child.once('exit',resolve);
 });
 if(code!==0)process.exitCode=1;
}finally{await fixture.cleanup();}
