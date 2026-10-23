// Explicit disposable fixture only. All identifiers come from synthetic native fixtures.
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
  const pool=new Pool(config);pool.on('error',()=>{});
  return {pg,config,pool,close:async()=>{await pool.end();await pg.cleanup();}};
 }catch(error){await pg.cleanup();throw error;}
}
export async function durableUatFixture(f,{pg,pool,config}){
 for(const tenant of f.store.db.prepare('SELECT id FROM tenants').all()){
  const state=exportTenantState(f.store,tenant.id);
  await pg.admin.query('INSERT INTO operations_engine_private.realms(tenant_id,governance) VALUES($1,$2)',[tenant.id,tenant.id===f.governance]);
  for(const user of state.payload.tables.users)await pg.admin.query('INSERT INTO operations_engine_private.principals(tenant_id,actor_id) VALUES($1,$2)',[tenant.id,user.id]);
  await pg.admin.query('INSERT INTO operations_engine_private.state(tenant_id,version,payload) VALUES($1,1,$2::jsonb)',[tenant.id,JSON.stringify(state.payload)]);
  for(const entry of state.audit)await pg.admin.query('INSERT INTO operations_engine_private.audit(tenant_id,sequence,entry) VALUES($1,$2,$3::jsonb)',[tenant.id,entry.sequence,JSON.stringify(entry)]);
 }
 const engine=new DurableOperationsPgEngine({pool,config});
 const make=()=>createDurableUatApplication({...f.dependencies,engine,platformNamespaceId:f.governance});
 return {engine,...await make(),restart:make};
}
