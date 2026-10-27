// Explicit disposable fixture only. All identifiers come from synthetic native fixtures.
import {createUatWorkflow} from '../../server/operations-uat-workflow.mjs';
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {isolatedPostgres} from '../../scripts/lib/isolated-postgres.mjs';
import {buildLocalOperationsPgConfig} from '../../server/operations-postgres.mjs';
import {DurableOperationsPgEngine,exportTenantState} from '../../server/operations-durable-postgres.mjs';
import {createDurableUatApplication} from '../../server/operations-durable-uat.mjs';
export async function durablePostgresFixture(){
 if(process.env.IWAY_BROWSER_DURABLE_OPT_IN!=='true')throw Error('DURABLE_BROWSER_OPT_IN_REQUIRED');
 const pg=await isolatedPostgres({optIn:true});
 try{
  await pg.admin.query('ALTER ROLE iway_operations_fixture NOINHERIT');
  const sql=(await readFile(new URL('../../db/review-only/b662-operations-engine.sql',import.meta.url),'utf8')).replaceAll('iway_operations_runtime','iway_operations_fixture');
  await pg.admin.query(sql);
  const config=buildLocalOperationsPgConfig({optIn:true,connection:pg.restricted,ca:pg.ssl.ca});
  const connect=()=>{const pool=new Pool(config);pool.on('error',()=>{});return pool;};
  const connectVerification=()=>{const pool=new Pool({...config,max:1});pool.on('error',()=>{});return pool;};
  let pool=connect(),verificationPool=connectVerification();
  return {pg,config,get pool(){return pool},get verificationPool(){return verificationPool},restartDatabase:async()=>{await Promise.all([pool.end(),verificationPool.end()]);await pg.restartDatabase();pool=connect();verificationPool=connectVerification();},close:async()=>{await Promise.all([pool.end(),verificationPool.end()]);await pg.cleanup();}};
 }catch(error){await pg.cleanup();throw error;}
}
export async function durableUatFixture(f,postgres){
 const {pg,config}=postgres;
 for(const tenant of f.store.db.prepare('SELECT id FROM tenants').all()){
  const state=exportTenantState(f.store,tenant.id);
  await pg.admin.query('INSERT INTO operations_engine_private.realms(tenant_id,governance) VALUES($1,$2)',[tenant.id,tenant.id===f.governance]);
  for(const user of state.payload.tables.users)await pg.admin.query('INSERT INTO operations_engine_private.principals(tenant_id,actor_id) VALUES($1,$2)',[tenant.id,user.id]);
  await pg.admin.query('INSERT INTO operations_engine_private.state(tenant_id,version,payload) VALUES($1,1,$2::jsonb)',[tenant.id,JSON.stringify(state.payload)]);
  for(const entry of state.audit)await pg.admin.query('INSERT INTO operations_engine_private.audit(tenant_id,sequence,entry) VALUES($1,$2,$3::jsonb)',[tenant.id,entry.sequence,JSON.stringify(entry)]);
 }
 const make=async()=>{
  const engine=new DurableOperationsPgEngine({pool:postgres.pool,config,verificationPool:postgres.verificationPool});
  const workflow=f.dependencies.ownerProfiles?createUatWorkflow({...f.uat.dependencies,ownerUserIds:[...new Set(f.dependencies.ownerProfiles.map(p=>p.ownerUserId))],lookupMembership:async userId=>{const entry=f.roster.find(e=>e.userId===userId);return entry&&await engine.verifyUatEntry(entry,f.governance)?f.uat.memberships.get(userId):null;}}):f.dependencies.workflow;
  return {engine,...await createDurableUatApplication({...f.dependencies,workflow,engine,platformNamespaceId:f.governance})};
 };
 return {...await make(),restart:make};
}
