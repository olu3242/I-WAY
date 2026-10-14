import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';

// Only application configuration is loaded. Unused API/admin keys and Node flags
// in a local file must not become inherited child-process configuration.
export const environmentKeys = [
 'PORT','NODE_ENV','DATABASE_URL','PGSSL','IWAY_CONSENT_VERSION','IWAY_LEADS_FILE',
 'IWAY_PG_TEST_OPT_IN','IWAY_PG_TEST_URL','IWAY_PG_TEST_HOST','IWAY_PG_TEST_CONSENT_VERSION'
];
export function loadProjectEnv({file=new URL('../.env.local',import.meta.url),env=process.env}={}){
 let source;
 try{source=readFileSync(file,'utf8')}catch(e){
  if(e.code==='ENOENT')return;
  throw new Error('.env.local: INVALID');
 }
 let values;
 try{values=parseEnv(source)}catch{throw new Error('.env.local: INVALID')}
 for(const key of environmentKeys){
  // Deployment/CI environment wins, including intentionally empty values.
  if(!Object.hasOwn(env,key)&&Object.hasOwn(values,key))env[key]=values[key];
 }
}
