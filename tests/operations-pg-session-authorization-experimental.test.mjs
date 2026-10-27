import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenantSessionAuthorizer} from '../server/operations-pg-session-authorization.experimental.mjs';
const session={verified:true,accountId:'account-1',tenantId:'tenant-1'};
const binding={active:true,accountId:'account-1',tenantId:'tenant-1',role:'driver'};
const input={sessionToken:'opaque-session',tenantId:'tenant-1',requiredRole:'driver'};
function setup(s=session,b=binding){
 let reads=0;
 const authorizer=createTenantSessionAuthorizer({verifySession:async()=>s,lookupBinding:async()=>{reads++;return b}});
 return {authorizer,getReads:()=>reads};
}
test('allows verified session only with exact tenant and role binding',async()=>{
 const {authorizer}=setup();
 assert.deepEqual(await authorizer.authorize(input),{tenantId:'tenant-1',accountId:'account-1',role:'driver'});
});
for(const [name,s,b] of [
 ['unverified session',{...session,verified:false},binding],
 ['cross tenant session',{...session,tenantId:'tenant-2'},binding],
 ['missing account',{...session,accountId:null},binding],
 ['missing binding',session,null],
 ['wrong role',session,{...binding,role:'platform'}],
 ['wrong binding tenant',session,{...binding,tenantId:'tenant-2'}],
 ['wrong account',session,{...binding,accountId:'account-2'}],
 ['revoked binding',session,{...binding,active:false}]
]){
 test('rejects '+name,async()=>{
  const {authorizer,getReads}=setup(s,b);
  await assert.rejects(authorizer.authorize(input),/SESSION_(AUTHORIZATION|ROLE)_REJECTED/);
  if(name==='cross tenant session'||name==='unverified session')assert.equal(getReads(),0);
 });
}
test('rejects missing token',async()=>{
 const {authorizer}=setup();
 await assert.rejects(authorizer.authorize({...input,sessionToken:''}),/SESSION_AUTHORIZATION_REQUIRED/);
});
