// CI fixtures only: never provider identities and never a hosted seeding workflow.
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const authFixture=Object.freeze({tenant:id(10),otherTenant:id(11),fleet:id(20),otherFleet:id(21),
 users:{platform:id(1),carrier:id(2),fleet:id(3),driver:id(4)},
 resources:{own:id(30),crossFleet:id(31),crossTenant:id(32),audit:id(33)}});
async function guard(client,env){
 if(env.IWAY_AUTH_FIXTURE!=='true'||env.PGHOST!=='127.0.0.1'||env.PGDATABASE!=='iway_auth_fixture'||
  typeof client?.release!=='function')throw Error('ISOLATED_AUTH_FIXTURE_REQUIRED');
 if((await client.query('SELECT current_database() AS name')).rows[0]?.name!=='iway_auth_fixture')throw Error('ISOLATED_AUTH_FIXTURE_REQUIRED');
}
export async function seedAuthFixture(client,env=process.env){
 await guard(client,env);const f=authFixture;
 await client.query('BEGIN');
 try{
  for(const user of Object.values(f.users))await client.query('INSERT INTO auth.users(id) VALUES($1) ON CONFLICT DO NOTHING',[user]);
  await client.query('INSERT INTO iway_private.auth_tenants(tenant_id,active) VALUES($1,true),($2,true) ON CONFLICT(tenant_id) DO UPDATE SET active=true',[f.tenant,f.otherTenant]);
  for(const [role,user] of Object.entries(f.users))await client.query(`INSERT INTO iway_private.auth_tenant_roles
   (user_id,tenant_id,role,active,permissions,principal_id,fleet_id) VALUES($1,$2,$3,true,$4,$1,$5)
   ON CONFLICT(user_id,tenant_id,role) DO UPDATE SET active=true,revoked_at=NULL,permissions=EXCLUDED.permissions,principal_id=EXCLUDED.principal_id,fleet_id=EXCLUDED.fleet_id`,
   [user,f.tenant,role,[role==='platform'?'platform:audit':'load:view'],f.fleet]);
  for(const [resource,tenant,kind,fleet,driver] of [
   [f.resources.own,f.tenant,'load',f.fleet,f.users.driver],
   [f.resources.crossFleet,f.tenant,'load',f.otherFleet,f.users.carrier],
   [f.resources.crossTenant,f.otherTenant,'load',f.fleet,f.users.driver],
   [f.resources.audit,f.tenant,'tenant-audit',null,null]]){
   await client.query(`INSERT INTO iway_private.auth_resources(resource_id,tenant_id,kind,fleet_id,driver_id,active)
    VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(resource_id) DO UPDATE SET active=true,tenant_id=EXCLUDED.tenant_id,
    kind=EXCLUDED.kind,fleet_id=EXCLUDED.fleet_id,driver_id=EXCLUDED.driver_id`,[resource,tenant,kind,fleet,driver]);
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
}
export async function deactivateAuthFixture(client,env=process.env){
 await guard(client,env);const f=authFixture;await client.query('BEGIN');
 try{
  await client.query('UPDATE iway_private.auth_tenant_roles SET active=false,revoked_at=COALESCE(revoked_at,now()) WHERE user_id=ANY($1::uuid[])',[Object.values(f.users)]);
  await client.query('UPDATE iway_private.auth_resources SET active=false WHERE resource_id=ANY($1::uuid[])',[Object.values(f.resources)]);
  await client.query('UPDATE iway_private.auth_tenants SET active=false WHERE tenant_id=ANY($1::uuid[])',[[f.tenant,f.otherTenant]]);
  await client.query(`UPDATE iway_private.auth_server_sessions SET revoked_at=COALESCE(revoked_at,now()),
   access_token=NULL,refresh_token=NULL,refresh_claim=NULL,refresh_started_at=NULL WHERE user_id=ANY($1::uuid[])`,[Object.values(f.users)]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}
}
