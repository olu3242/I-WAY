import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseTenantRoleStore} from '../server/operations-supabase-tenant-role-store.experimental.mjs';
const userId='11111111-1111-4111-8111-111111111111';
const tenantId='22222222-2222-4222-8222-222222222222';
test('B447 role binding uses parameterized server-only query',async()=>{
 let statement,parameters;
 const store=createSupabaseTenantRoleStore({query:async(sql,params)=>{statement=sql;parameters=params;return {rowCount:1};}});
 await store.grant({userId,tenantId,role:'driver'});
 assert.match(statement,/ON CONFLICT/);
 assert.deepEqual(parameters,[userId,tenantId,'driver']);
 assert.equal(await store.hasActiveRole({userId,tenantId,role:'driver'}),true);
 assert.match(statement,/revoked_at IS NULL/);
});
test('B447 invalid identities and roles fail closed',async()=>{
 let called=false;
 const store=createSupabaseTenantRoleStore({query:async()=>{called=true;return {rowCount:1};}});
 await assert.rejects(store.grant({userId:'bad',tenantId,role:'platform'}),/INVALID_SUPABASE_ROLE_BINDING/);
 assert.equal(await store.hasActiveRole({userId,tenantId,role:'admin'}),false);
 assert.equal(called,false);
});
test('B447 unsuccessful insert cannot report granted access',async()=>{
 const store=createSupabaseTenantRoleStore({query:async()=>({rowCount:0})});
 await assert.rejects(store.grant({userId,tenantId,role:'carrier'}),/SUPABASE_ROLE_BINDING_NOT_PERSISTED/);
});
