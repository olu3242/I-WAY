import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtectedRoutePipeline} from '../server/operations-supabase-protected-route-pipeline.experimental.mjs';
const sid='s'.repeat(43);
test('B469 pipeline enforces route-owned tenant and role end to end',async()=>{
 let authorized=0;
 const pipeline=createProtectedRoutePipeline({
  routes:[{method:'GET',path:'/api/fleet/tracking',tenantId:'tenant-a',role:'fleet'}],
  authorizeSession:async ({sessionId,tenantId,role})=>({ok:sessionId===sid&&tenantId==='tenant-a'&&role==='fleet',userId:'user-a'}),
  handleAuthorized:async ({userId})=>{authorized++;assert.equal(userId,'user-a');return {ok:true,accessToken:'NEVER_SERIALIZE'};}
 });
 const valid=await pipeline({method:'GET',path:'/api/fleet/tracking',headers:{cookie:'iway_session='+sid},tenantId:'tenant-b',role:'platform'});
 assert.equal(valid.status,200);assert.equal(authorized,1);
 assert.ok(!JSON.stringify(valid).includes('NEVER_SERIALIZE'));
 assert.equal((await pipeline({method:'GET',path:'/api/fleet/tracking',headers:{cookie:'iway_session=invalid'}})).status,401);
 assert.equal((await pipeline({method:'POST',path:'/api/fleet/tracking',headers:{cookie:'iway_session='+sid}})).status,404);
 assert.equal(authorized,1);
});
