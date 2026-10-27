import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseTenantAuthorization} from '../server/operations-supabase-tenant-authorization.experimental.mjs';
const tenantId='22222222-2222-4222-8222-222222222222';
test('B448 missing and invalid Supabase sessions fail closed',async()=>{
 let lookedUp=false;
 const guard=createSupabaseTenantAuthorization({getUser:async()=>({data:{user:null}}),roleStore:{hasActiveRole:async()=>{lookedUp=true;return true;}}});
 assert.deepEqual(await guard.authorize({tenantId,role:'driver'}),{allowed:false,reason:'MISSING_SESSION'});
 assert.deepEqual(await guard.authorize({accessToken:'invalid',tenantId,role:'driver'}),{allowed:false,reason:'INVALID_SESSION'});
 assert.equal(lookedUp,false);
});
test('B448 verified user is restricted to active tenant role',async()=>{
 const guard=createSupabaseTenantAuthorization({
  getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}}),
  roleStore:{hasActiveRole:async({tenantId:id,role})=>id===tenantId&&role==='driver'}
 });
 assert.equal((await guard.authorize({accessToken:'valid',tenantId,role:'driver'})).allowed,true);
 assert.deepEqual(await guard.authorize({accessToken:'valid',tenantId:'33333333-3333-4333-8333-333333333333',role:'driver'}),{allowed:false,reason:'TENANT_ROLE_DENIED'});
 assert.deepEqual(await guard.authorize({accessToken:'valid',tenantId,role:'platform'}),{allowed:false,reason:'TENANT_ROLE_DENIED'});
});
test('B448 identity provider and authorization store failures deny access',async()=>{
 const offline=createSupabaseTenantAuthorization({getUser:async()=>{throw Error('offline');},roleStore:{hasActiveRole:async()=>true}});
 assert.deepEqual(await offline.authorize({accessToken:'x',tenantId,role:'driver'}),{allowed:false,reason:'IDENTITY_PROVIDER_UNAVAILABLE'});
 const storeOffline=createSupabaseTenantAuthorization({getUser:async()=>({data:{user:{id:'u'}}}),roleStore:{hasActiveRole:async()=>{throw Error('offline');}}});
 assert.deepEqual(await storeOffline.authorize({accessToken:'x',tenantId,role:'driver'}),{allowed:false,reason:'AUTHORIZATION_STORE_UNAVAILABLE'});
});
