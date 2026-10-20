import test from 'node:test';
import assert from 'node:assert/strict';
import {createIwayProtectedHttpHandler} from '../server/operations-supabase-protected-http.experimental.mjs';
const tenantId='11111111-2222-3333-4444-555555555555';
const policy={tenantId,role:'carrier'};
const request={headers:{authorization:'Bearer token.valid'},policy,body:{tenantId:'attacker',role:'platform'}};
test('B452-B459 only verified identity with active role reaches handler',async()=>{
 let called=0;
 const handler=createIwayProtectedHttpHandler({getUser:async()=>({data:{user:{id:'verified'}}}),roleStore:{hasActiveRole:async x=>x.userId==='verified'&&x.tenantId===tenantId&&x.role==='carrier'},handleAuthorized:async x=>{called++;return {status:200,body:x};}});
 const good=await handler(request);
 assert.equal(good.status,200);assert.equal(good.body.userId,'verified');assert.equal(good.body.role,'carrier');assert.equal(called,1);
 assert.equal((await handler({...request,headers:{authorization:'Bearer token.valid'},policy:{...policy,role:'platform'}})).status,403);
 assert.equal((await handler({...request,headers:{authorization:'Basic secret'}})).status,401);
 assert.equal(called,1);
});
test('B452-B459 provider outage and role store outage deny',async()=>{
 for(const [getUser,hasActiveRole] of [[async()=>{throw Error('down')},async()=>true],[async()=>({data:{user:{id:'verified'}}}),async()=>{throw Error('down')}]]) {
 const h=createIwayProtectedHttpHandler({getUser,roleStore:{hasActiveRole},handleAuthorized:async()=>{throw Error('should not run')}});
 assert.equal((await h(request)).status,403);
 }
});
