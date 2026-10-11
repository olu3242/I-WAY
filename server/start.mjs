import {makeApp} from './app.mjs';
import {registerPgLead} from './pg-lead-store.mjs';
const port=Number(process.env.PORT??4173);
const dbPath=process.env.IWAY_LEADS_FILE??'data/early-access.json';
let pool;
let register;
if(process.env.DATABASE_URL){
 if(!process.env.IWAY_CONSENT_VERSION)throw new Error('IWAY_CONSENT_VERSION required with PostgreSQL');
 const {Pool}=await import('pg');
 pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='require'?{rejectUnauthorized:true}:undefined});
 await pool.query('SELECT 1');
 register=lead=>registerPgLead(pool,lead,{consentVersion:process.env.IWAY_CONSENT_VERSION});
 console.log('I-way PostgreSQL connection ready (registration write not yet certified)');
}else if(process.env.NODE_ENV==='production'){
 throw new Error('DATABASE_URL required in production; refusing ephemeral file storage');
}
const app=makeApp({dbPath,register});
app.listen(port,()=>console.log('I-way listening on port '+port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{app.close();if(pool)await pool.end();process.exit(0)});
