import {makeApp} from './app.mjs';
import {registerPgLead} from './pg-lead-store.mjs';
import {ConfigurationError,serverConfig} from './config.mjs';
import {loadProjectEnv} from '../scripts/load-env.mjs';
let pool;
try{
 loadProjectEnv();
 const config=serverConfig();
 let register;
 if(config.postgres){
  const {Pool}=await import('pg');
  pool=new Pool(config.postgres);
  await pool.query('SELECT 1');
  register=lead=>registerPgLead(pool,lead,{consentVersion:config.consentVersion});
  console.log('I-way PostgreSQL connection ready (registration write not yet certified)');
 }
 const app=makeApp({dbPath:config.dbPath,register});
 app.listen(config.port,()=>console.log('I-way listening on port '+app.address().port));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{app.close();if(pool)await pool.end();process.exit(0)});
}catch(e){
 // Never emit driver errors, parsed URLs, or dotenv contents.
 console.error(e instanceof ConfigurationError?e.message:'Registration startup configuration or connection failed');
 if(pool)await pool.end().catch(()=>{});
 process.exitCode=1;
}
